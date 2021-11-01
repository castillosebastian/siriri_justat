require('dotenv').config();
import fetch from 'node-fetch';
import { MongoClient, ObjectID, Db, ObjectId } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ExpedientesService } from '../expedientes/expedientes.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

const desde = new Date('2021-01-07');
const hasta = new Date('2021-01-14');

enviarPendientes().then(() => console.log('ok'));
async function enviarPendientes() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const notificacionesService = app.get(NotificacionesService);
  const mongoClient = new MongoClient(process.env.MONGODB_URL, {
    useNewUrlParser: true,
  });
  const connection = await mongoClient.connect();
  const db = connection.db();

  const pendientes = db.collection('expedientes').aggregate(
    [
      //{$match: {_id: ObjectId("5ebd21fe2eec360009d7f82c")}},
      { $match: { 'movimientos.fecha_hora': { $gte: desde, $lte: hasta } } },
      { $unwind: '$justiciables' },
      { $unwind: '$justiciables.abogados' },
      { $group: { _id: '$_id', abogados: { $addToSet: '$justiciables.abogados.lex_id' } } },
      { $set: { abogados: { $size: '$abogados' } } },
      { $match: { abogados: { $gt: 0 } } },
      {
        $lookup: { from: 'expedientes', localField: '_id', foreignField: '_id', as: 'expediente' },
      },
      { $unwind: '$expediente' },
      { $unwind: '$expediente.movimientos' },
      // // tslint:disable-next-line: max-line-length
      {
        $project: {
          codigo_organismo: '$expediente.lex_id.codigo_organismo',
          movimiento_id: '$expediente.movimientos._id',
          movimiento_lex_id: '$expediente.movimientos.lex_id',
          tipo: '$expediente.movimientos.tipo',
          fecha_movimiento: '$expediente.movimientos.fecha_hora',
          fecha_procesal: '$expediente.movimientos.fecha_procesal',
          descripcion: '$expediente.movimientos.descripcion',
          exp1: '$expediente.nro.exp1',
          actora: '$expediente.actora',
          demandada: '$expediente.demandada',
          abogados: '$abogados',
        },
      },
      // // tslint:disable-next-line: max-line-length
      { $match: { fecha_movimiento: { $gte: desde, $lte: hasta }, tipo: /procesal/ } },
      {
        $lookup: {
          from: 'notificaciones',
          let: { mov_lex_id: '$movimiento_lex_id', expediente_id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$expediente', '$$expediente_id'] },
                    { $eq: ['$movimiento_lex_id', '$$mov_lex_id'] },
                  ],
                },
              },
            },
            { $project: { notificacion_id: '$_id' } },
          ],
          as: 'notificaciones',
        },
      },
      // tslint:disable-next-line: max-line-length
      {
        $project: {
          exp1: 1,
          actora: 1,
          demandada: 1,
          movimiento_id: 1,
          fecha_movimiento: 1,
          descripcion: 1,
          movimiento_lex_id: 1,
          tipo: 1,
          abogados: 1,
          notificaciones: { $size: '$notificaciones' },
        },
      },
      { $set: { correcto: { $gte: ['$notificaciones', '$abogados'] } } },
      { $match: { correcto: false } },
      { $sort: { fecha_movimiento: -1 } },
    ],
    { allowDiskUse: true },
  );
  const pendientesArray = await pendientes.toArray();

  let contador = 1;
  for (const pendiente of pendientesArray) {
    console.log(
      `${contador}/${pendientesArray.length}`,
      pendiente._id.toString(),
      pendiente.movimiento_id.toString(),
    );
    contador += 1;
    const url = `http://expedientes-prod.aplicaciones.jusentrerios.gov.ar/notificaciones/forzar/${pendiente._id}/${pendiente.movimiento_lex_id}?token=${process.env.EXPEDIENTES_ACCESS_TOKEN}`;
    try {
      await fetch(url, { method: 'PUT' });
    } catch (e) {
      console.log('------ err');
    }

    // await notificacionesService.forzarNotificacion(pendiente._id.toString(), pendiente.movimiento_id.toString())
  }

  await connection.close(true);
  await app.close();
}
