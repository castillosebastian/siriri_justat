import datetime
from re import match
from dns.rdatatype import NULL
import pymongo
from bson.son import SON
import datetime
import pprint

#ref
# https://docs.mongodb.com/manual/reference/operator/
# https://www.analyticsvidhya.com/blog/2020/08/query-a-mongodb-database-using-pymongo/


client = pymongo.MongoClient("10.101.2.97", 27017)
db = client.test
print(client.list_database_names())

# Agrego acceso a bd expedientes
db_expedientes = client['expedientes_production']

# print(db_expedientes.list_collection_names())
pprint.pprint(db_expedientes.organismos.find_one())
pprint.pprint(db_expedientes.expedientes.find_one())


# Prueba consulta muchos: OK
for item in db_expedientes.organismos.find():
    pprint.pprint(item["codigo"])

# Prueba consulta condicional organismo:OK
q1 = db_expedientes.organismos.aggregate([
    {
        "$match": {"jurisdiccion" : {"$eq":"Nogoyá"} }
    }
    ])    

for i in q1:
    pprint.pprint(i)


# Prueba consulta con filtros: OK
q2 = db_expedientes.expedientes.aggregate([    
    {
        "$match": {"demandada" : {"$eq":"IRIZAGA ELSA"}} 
    },
    {
        "$match": {"actora" : {"$eq":"RODRIGUEZ MIGUEL SERGIO"}} 
    },
    {
        "$project": {
            "_id": 1,
            "codigo_organismo": '$lex_id.codigo_organismo',
            "tipo_proceso": '$tipo_proceso.tipo',
            "descripcion": '$movimientos.descripcion',
            "fecha_hora": '$movimientos.fecha_hora',
            "jurisdiccion": '$datos_organismo.jurisdiccion',
            "localidad": '$datos_organismo.localidad',
            "organismo": '$datos_organismo.nombre_organismo',
            "publico": '$movimientos.publico',
            "tipo_movimiento": '$movimientos.tipo'
        }
    }
])
for i in q2:
    pprint.pprint(i)

# Prueba consulta con filtro mas compleja: OK, satura memoria
q3 = db_expedientes.expedientes.aggregate([    
    {
        "$match": {"grupo" : {"$eq":"EnTramite"}} 
    },
    {
        "$match": {"estado_salida" : {"$eq":"A despacho"}} 
    },
    {
        "$project": {
            "_id": 1,
            "codigo_organismo": '$lex_id.codigo_organismo',
            "tipo_proceso": '$tipo_proceso.tipo',
            "descripcion": '$movimientos.descripcion',
            "fecha_hora": '$movimientos.fecha_hora',
            "jurisdiccion": '$datos_organismo.jurisdiccion',
            "localidad": '$datos_organismo.localidad',
            "organismo": '$datos_organismo.nombre_organismo',
            "publico": '$movimientos.publico',
            "tipo_movimiento": '$movimientos.tipo'
        }
    } 
])

for i in q3:
    pprint.pprint(i)

# Prueba consulta con filtro mas compleja: OK, satura memoria
# convert your date string to datetime object
start = datetime.datetime(2001, 4, 4, 0, 0)
end = datetime.datetime(2001, 4, 4, 0, 0)

db_expedientes.expedientes.find_one({'inicio': {'$gte': start, '$lte': end}}) # OK
db_expedientes.expedientes.find_one({"estado_salida" : {"$eq":"A despacho"}}) # OK
# El dato de "procesal_presentacion" en el TS está construido. VER FEDE
db_expedientes.expedientes.find_one({"movimientos.tipo" : {"$in":  ['procesal', 'procesal_presentacion']}}) # OK

q4 = db_expedientes.expedientes.aggregate([
    {
        "$match": {'inicio': {'$gte': start, '$lte': end}} 
    },     
    {
        "$match": {"estado_salida" : {"$eq":"A despacho"}} 
    },
    {
        "$match": {"movimientos.tipo" : {"$eq":  'procesal'}} 
    }, 
    {
        "$project": {
            "_id": 1,
            "codigo_organismo": '$lex_id.codigo_organismo',
            "tipo_proceso": '$tipo_proceso.tipo',
            "descripcion": '$movimientos.descripcion',
            "fecha_hora": '$movimientos.fecha_hora',
            "jurisdiccion": '$datos_organismo.jurisdiccion',
            "localidad": '$datos_organismo.localidad',
            "organismo": '$datos_organismo.nombre_organismo',
            "publico": '$movimientos.publico',
            "tipo_movimiento": '$movimientos.tipo'
        }
    }
])

for i in q4:
    pprint.pprint(i)
