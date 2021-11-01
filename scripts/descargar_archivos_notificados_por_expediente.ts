require('dotenv').config();
import { MongoClient, ObjectID } from 'mongodb';
import * as Minio from 'minio';
import * as path from 'path';
import * as fs from 'fs';
const fsPromises = fs.promises;
const expedienteId = '5df238453e87930009f1f085';
const ejecucion = new Date();
const carpetaDestino = '../';
descargarArchivosNotificacionesPorExpediente()
  .then(() => console.log('ok'))
  .catch((e) => console.error(e));

interface IDatosMovimiento {
  expediente_lex_id: {
    proc: string;
    codigo_organismo: string;
  };
  movimiento_lex_id: string;
  extension: string;
}

async function descargarArchivosNotificacionesPorExpediente() {
  const mapaArchivos = new Map<string, IDatosMovimiento>();

  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT, 10),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.SECRET_KEY,
    useSSL: false,
  });
  const mongoClient = new MongoClient(process.env.MONGODB_URL, {
    useNewUrlParser: true,
  });
  const connection = await mongoClient.connect();
  const db = connection.db();

  const cursorNotificaciones = db
    .collection('notificaciones')
    .aggregate([{ $match: { expediente: new ObjectID(expedienteId) } }], { allowDiskUse: true });

  await new Promise<void>((resolve, reject) => {
    cursorNotificaciones.each(function (err, doc: any) {
      if (err) {
        return reject(err);
      }
      if (!doc) {
        return resolve();
      }
      mapaArchivos.set(`${doc.md5_documento}.${doc.tipo_documento}`, {
        expediente_lex_id: doc.expediente_lex_id,
        movimiento_lex_id: doc.movimiento_lex_id,
        extension: doc.tipo_documento,
      });
      // console.log(doc)
    });
  });

  let promesas = Array.from(mapaArchivos.keys()).map(async (documento) => {
    const datos = mapaArchivos.get(documento);
    const carpetaDestinoArchivo = path.resolve(carpetaDestino, datos.expediente_lex_id.proc);
    try {
      await fsPromises.access(carpetaDestinoArchivo, fs.constants.F_OK);
    } catch (e) {
      console.log('creando carpeta', carpetaDestinoArchivo);
      await fsPromises.mkdir(carpetaDestinoArchivo);
    }
    const destino = path.resolve(
      carpetaDestinoArchivo,
      `${datos.movimiento_lex_id}.${datos.extension}`,
    );
    await minioClient.fGetObject('notificaciones', documento, destino);
    console.log(documento, destino);
  });
  await Promise.all(promesas);

  await connection.close(true);
}
