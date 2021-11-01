require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { MongoClient, ObjectId } from 'mongodb';
import { AppModule } from '../app.module';
const csv = require('csv-parser')
import * as fs from 'fs'
import { HttpService } from '@nestjs/common';
const ejecucion = new Date();
corregirSalidas().then(() => console.log('ok'));
interface IDatosSalidas {
    id: string,
    codigo: string,
    jurisdiccion: string,
    localidad: string,
    nombre: string,
    pase_descripcion: string,
    tsal: string,
}
async function corregirSalidas() {
    const datos_pase_mongo = await leerCSV<IDatosSalidas>('src/scripts/organismos_mongo_pase.csv')
    const app = await NestFactory.createApplicationContext(AppModule);

    const mongoClient = new MongoClient(process.env.MONGODB_URL, {
        useNewUrlParser: true,
    });
    const connection = await mongoClient.connect();
    const db = connection.db();
    const httpService = app.get(HttpService)

    const cantidadQuery = db.collection('expedientes').aggregate([
        // { $match: { _id: new ObjectId("5d57672b850c0000095a91f9"), "datos_organismo.nombre_organismo": {$regex : ".*Feria.*"} } },
        { $match: {"datos_organismo.nombre_organismo": {$regex : ".*Feria.*"} } },
        { $count: 'cantidad'}
    ], { allowDiskUse: true })
    const cursorExpedientes = db.collection('expedientes').aggregate([
        // { $match: { _id: new ObjectId("5d57672b850c0000095a91f9"), "datos_organismo.nombre_organismo": {$regex : ".*Feria.*"} } },
        { $match: {"datos_organismo.nombre_organismo": {$regex : ".*Feria.*"} } },
    ], { allowDiskUse: true })
    const cantidad = (await cantidadQuery.toArray())[0].cantidad

    let index = 1
    while (await cursorExpedientes.hasNext()) {
        const doc = await cursorExpedientes.next();
        console.error(`${index++}/${cantidad}`)
        if (doc.estado_salida?.startsWith("PASE DIRECTO")) {
                // console.log("============================================================")
                // console.log(doc._id, doc.actora, doc.demandada, `${doc.datos_organismo.jurisdiccion}, ${doc.datos_organismo.nombre_organismo}`)
                const copiaSalidas: Promise<{data: string}>[] = (doc.salidas as any[])
                    .filter(s => s.descripcion.startsWith("PASE DIRECTO"))
                    .filter(s => !s.fecha_regreso)
                    .filter((salida, index, self) => self.findIndex(s => s.descripcion == salida.descripcion) == index) // evitar duplicados
                    .map(s => {
                        const organismo_destino = datos_pase_mongo.find(o => o.pase_descripcion == s.descripcion)
                        // console.log(s)
                        // console.log(organismo_destino)
                        if(organismo_destino) {
                            if (organismo_destino.codigo == doc.lex_id.codigo_organismo) {
                                return Promise.resolve({data: `${JSON.stringify({dbOrigen: doc.lex_id.codigo_organismo, procOrigen: doc.lex_id.proc} )} | origen y destino son el mismo`})    
                            }
                            return httpService.post(process.env.LEX_ACCESS_URL+'pase/copiarSalidas',{
                                dbOrigen: doc.lex_id.codigo_organismo,
                                procOrigen: doc.lex_id.proc,
                                dbDestino: organismo_destino.codigo                    
                            }).toPromise()
                        } else {
                            return Promise.resolve({data: `${JSON.stringify({dbOrigen: doc.lex_id.codigo_organismo, procOrigen: doc.lex_id.proc} )} | no se encontro destino '${s.descripcion}'`})
                        }
                    });
                const resultadosCopia = await Promise.all(copiaSalidas)
                console.log(resultadosCopia.map(r => r.data))
        }
            
    }

    await connection.close(true);
    await app.close()
}


function leerCSV<T>(path) : Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
        const results: T[] = [];

        fs.createReadStream(path)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('error', (e) => { reject(e)  })
          .on('end', () => {  resolve(results) });
    })
}