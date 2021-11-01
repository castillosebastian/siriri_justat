require('dotenv').config();
import fetch from 'node-fetch';
import { MongoClient, ObjectID, Db, ObjectId } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LexAccessService } from '../lexaccess/lexaccess.service';
import { INestApplicationContext } from '@nestjs/common';
const desde=new Date('2020-05-19T00:00:00-03:00')
const hasta=new Date('2020-05-21T00:00:00-03:00')

const ejecucion = new Date();
eliminarPresentacionesDuplicadas().then(() => console.log('ok'));
async function eliminarPresentacionesDuplicadas() {
    const app = await NestFactory.createApplicationContext(AppModule);

    const lexAccesService = app.get(LexAccessService)

    const mongoClient = new MongoClient(process.env.MONGODB_URL, {
        useNewUrlParser: true,
      });
    const connection = await mongoClient.connect();
    const db = connection.db();

    const paraEliminar =
    db.collection('presentaciones').aggregate([
        {$match: {estado: {$ne: 'finalizada'}, fecha_hora: {$gte: desde, $lte: hasta}}, },
        {$lookup: {
               from: 'expedientes',
               localField: 'expediente',
               foreignField: '_id',
               as: 'expediente'
             }},
        {$unwind: '$expediente'},
        {$unwind: '$expediente.movimientos'},
        {$match: {$expr: {$eq: ['$movimiento_lex_id', '$expediente.movimientos.lex_id']}}},
        {$set: {movimiento_expediente_lex_id: '$expediente.movimientos.lex_id'}},
        {$sort: {fecha_hora: 1}},
        {$group: { _id: {abogado: '$origen', expediente_id: '$expediente._id', lex_md5: '$expediente.movimientos.archivo.lex_md5', }, queda: {$first: '$_id'}, todos: {$addToSet: '$_id'}, cantidad: {$sum: 1}}},
        {$match: {cantidad: {$gte: 2}}},
    ])
    const paraEliminarArray = await paraEliminar.toArray();

    const totalPresentacionesAEliminar = []

    for(const aEliminar of paraEliminarArray) {
        const presentacionesAEliminar = aEliminar.todos.filter(item => {
            return item.toString() !== aEliminar.queda.toString()
        })
        totalPresentacionesAEliminar.push(...presentacionesAEliminar)
    }

    let eliminados = 0;
    for(const presentacionAEliminar of totalPresentacionesAEliminar)  {
        const presentacionEliminada = await db.collection('presentaciones_eliminadas_2020-05-11').findOne({_id: new ObjectID(presentacionAEliminar)})
        if(!presentacionEliminada) {
            const presentacion = await db.collection('presentaciones').findOne({_id: new ObjectID(presentacionAEliminar)})
            await db.collection('presentaciones_eliminadas_2020-05-11').insertOne(presentacion)
            // await lexAccesService.eliminarMovimiento(presentacion.expediente_lex_id, presentacion.movimiento_lex_id)
            await db.collection('presentaciones').deleteOne({_id: new ObjectID(presentacionAEliminar)})
            console.log('eliminados : ', eliminados, '/', totalPresentacionesAEliminar.length)
        }
        eliminados = eliminados +1;
    }
    await sincronizarExpedientes()
    await connection.close(true);
    await app.close()
}


async function sincronizarExpedientes() {

    const app = await NestFactory.createApplicationContext(AppModule);

    const lexAccesService = app.get(LexAccessService)

    const mongoClient = new MongoClient(process.env.MONGODB_URL, {
        useNewUrlParser: true,
      });
    const connection = await mongoClient.connect();
    const db = connection.db();

    const paraSincronizar = await db.collection("presentaciones_eliminadas_2020-05-11").aggregate([
        {$match: { fecha_hora: {$gte: desde, $lte: hasta}}},
        {$group: { _id: '$expediente', cantidad: {$sum: 1}}, },
        {$sort: {cantidad: -1}}
    ]).toArray()

    for(const aSincronizar of paraSincronizar) {
        console.log('sincronizando: ', aSincronizar._id)
        try {
            await lexAccesService.sincronizar(aSincronizar._id)
        } catch (e) {
            console.error('err---')
        }
    }


}