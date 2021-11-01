require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { MongoClient } from 'mongodb';
import { AppModule } from '../app.module';
import * as fs from 'fs';
const stringify = require('csv-stringify');

const desde = new Date('2021-08-05T00:00:00-03:00');
const hasta = new Date('2021-10-01T00:00:00-03:00');

const ejecucion = new Date();
reportarMovimientosProcesales().then(() => console.log('ok'));
async function reportarMovimientosProcesales() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const mongoClient = new MongoClient(process.env.MONGODB_URL, {
    useNewUrlParser: true,
  });
  const connection = await mongoClient.connect();
  const db = connection.db();

  const cursorMovimientos = db.collection('expedientes').aggregate(
    [
      { $match: { 'movimientos.fecha_hora': { $gte: desde, $lte: hasta } } },
      { $addFields: { abogados: { $size: { $ifNull: ['$justiciables.abogados.lex_id', []] } } } },
      { $match: { abogados: { $gt: 0 } } },
      { $unwind: '$movimientos' },
      // tslint:disable-next-line: max-line-length
      {
        $match: {
          'movimientos.fecha_hora': { $gte: desde, $lte: hasta },
          'movimientos.tipo': { $in: [null, 'procesal', 'procesal_presentacion'] },
        },
      },
      {
        $project: {
          _id: 1,
          codigo_organismo: '$lex_id.codigo_organismo',
          tipo_proceso: '$tipo_proceso.tipo',
          descripcion: '$movimientos.descripcion',
          fecha_hora: '$movimientos.fecha_hora',
          jurisdiccion: '$datos_organismo.jurisdiccion',
          localidad: '$datos_organismo.localidad',
          organismo: '$datos_organismo.nombre_organismo',
          publico: '$movimientos.publico',
          tipo_movimiento: '$movimientos.tipo',
        },
      },
      { $sort: { fecha_hora: 1 } },
    ],
    { allowDiskUse: true },
  );

  var reporteStream = fs.createWriteStream(
    `./movimientos_procesales_${desde.toISOString().split('T')[0]}_${hasta.toISOString().split('T')[0]
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
