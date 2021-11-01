require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { MongoClient } from 'mongodb';
import { AppModule } from '../app.module';
import * as fs from 'fs';
const stringify = require('csv-stringify');

const desde = new Date('2020-02-01T00:00:00-03:00');
const hasta = new Date('2020-09-07T00:00:00-03:00');

const ejecucion = new Date();
reportarPresentacionesProcesales().then(() => console.log('ok'));
async function reportarPresentacionesProcesales() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const mongoClient = new MongoClient(process.env.MONGODB_URL, {
    useNewUrlParser: true,
  });
  const connection = await mongoClient.connect();
  const db = connection.db();

  const cursorMovimientos = db.collection('presentaciones').aggregate(
    [
      { $match: { fecha_hora: { $gte: desde, $lte: hasta } } },
      {
        $lookup: {
          from: 'notificaciones',
          let: {
            expedientePresentacion: '$expediente',
            movimientoPresentacion: '$movimiento_lex_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$expediente', '$$expedientePresentacion'] },
                    { $eq: ['$movimiento_lex_id', '$$movimientoPresentacion'] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'notificacion',
        },
      },
      { $unwind: '$notificacion' },
      { $sort: { fecha_hora: 1 } },
      {
        $project: {
          _id: 0,
          codigo_organismo: '$expediente_lex_id.codigo_organismo',
          descripcion: '$descripcion',
          jurisdiccion: '$datos_organismo.jurisdiccion',
          localidad: '$datos_organismo.localidad',
          organismo: '$datos_organismo.nombre_organismo',
          fecha_hora_presentacion: '$fecha_hora',
          fecha_hora_procesal: '$notificacion.enviada',
        },
      },
    ],
    { allowDiskUse: true },
  );

  var reporteStream = fs.createWriteStream(
    `./presentaciones_procesales_${desde.toISOString().split('T')[0]}_${
      hasta.toISOString().split('T')[0]
    }.csv`,
  );
  const stringifier = stringify({
    delimiter: ',',
    header: true,
    cast: {
      date: function (value) {
        return value.toISOString();
      },
    },
  });

  stringifier.pipe(reporteStream);
  await new Promise<void>((resolve) => {
    cursorMovimientos.each(function (err, doc: any) {
      if (!doc) {
        stringifier.end();
        return resolve();
      }
      stringifier.write(doc);
    });
  });
  await connection.close(true);
  await app.close();
}
