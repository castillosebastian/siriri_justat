#%% Libraries
# Data manipulation and Viz
import pandas as pd
import numpy as np
import os
import nltk
# data visualization
import matplotlib.pyplot as plt
from pytz import timezone
import seaborn as sns
import matplotlib.dates as mdates
from matplotlib import collections
# machine learning
from sklearn.preprocessing import StandardScaler
import sklearn.linear_model as skl_lm
from sklearn import preprocessing
from sklearn import neighbors
from sklearn.metrics import confusion_matrix, classification_report, precision_score
from sklearn.model_selection import train_test_split
import statsmodels.api as sm
import statsmodels.formula.api as smf
from neuralprophet import NeuralProphet
from scipy import stats
# others
import bs4
import io
import requests
import json
# initialize some package settings
sns.set(style="whitegrid", color_codes=True, font_scale=1.3)
%matplotlib inline
# Mongo tools
from pymongo import MongoClient
import pymongo
from pprint import pprint
from sklearn import pipeline
import datetime   # This will be needed later
import os
# External ref
# Aggregation Framewok
# https://www.practical-mongodb-aggregations.com/examples/trend-analysis/incremental-analytics.html
# From Mongo to Pandas
# https://docs.mongodb.com/manual/reference/operator/aggregation/setWindowFields/?_ga=2.230420636.1035413487.1644869335-438496097.1644675676
# https://www.mongodb.com/developer/quickstart/pymongoarrow-and-data-analysis/
# Windows calculation for smoth lines
# https://www.mongodb.com/developer/article/window-functions-and-time-series/#:~:text=Window%20functions%20allow%20you%20to,working%20with%20time%2Dseries%20data.

#%% client = MongoClient()
client = MongoClient('mongodb://10.101.2.97:27017/?readPreference=primary&ssl=false')
bd = client["expedientes_production"]
collections = bd.list_collection_names()
expedientes = bd['expedientes'] 
 
#%% Variables
from datetime import datetime
start_date = datetime(2021, 2, 1)
end_date = datetime(2021, 2, 28)

#%% Get the documents betwen dates:
pipeline = [
   {
      # filtro por fecha
      "$match": {
         "inicio": {
            '$gte': start_date,
            '$lte': end_date
         }
      }
   }, {
      # excluyo no procesos
      # OJO ESTAN PASANDO LOS PLURALES DE LOS NO PROCESOS
      '$lookup': {
         'from': 'no_procesos', 
         'localField': 'tipo_proceso.tipo', 
         'foreignField': 'item', 
         'as': 'temp'
      }
    }, {
      '$match': {
         'temp': {
            '$size': 0
         }
      }
    }, {
       # agrupo
       "$group": {
          "_id": {
             # agrupar por fecha, organismo y tipo de proceso
             'fecha_inicio': '$inicio',
             'organismo': '$lex_id.codigo_organismo',
             'tipo_proceso': '$tipo_proceso.tipo', 
          },
         # Count the number instances in the group:         
         "cantidad_iniciados": {
            "$sum": 1
         }, 
         'causa': {
            '$addToSet': '$_id' #identifica dato primario
         }               
      }
   }, {
      '$sort': {
         '_id.organismo':1
      }
   }
]
results = expedientes.aggregate(pipeline)
for i in results:
   pprint(i)

#%%
# Procesar grupos de procesos:
# db.myColl.aggregate( [ { $addFields: { results: { $regexMatch: { input: "$category", regex: /cafe/ }  } } } ] )


#%% Get the documents betwen dates:
from datetime import datetime, timezone
start_date = datetime(2021, 2, 1, 0, 0, 0,   tzinfo = timezone.utc)
end_date = datetime(2021, 2, 28, 0, 0, 0, tzinfo = timezone.utc)

pipeline = [
   {
      # filtro por fecha
      "$match": {
         "inicio": {
            '$gte': start_date,
            '$lte': end_date
         }
      }
   }, {
      # excluyo no procesos
      # OJO ESTAN PASANDO LOS PLURALES DE LOS NO PROCESOS
      '$lookup': {
         'from': 'no_procesos', 
         'localField': 'tipo_proceso.tipo', 
         'foreignField': 'item', 
         'as': 'temp'
      }
    }, {
      '$match': {
         'temp': {
            '$size': 0
         }
      }
    }, {
       # agrupo
       "$group": {
          "_id": {
             # agrupar por fecha, organismo y tipo de proceso
             'fecha_inicio': '$inicio',
             'organismo': '$lex_id.codigo_organismo',
             'tipo_proceso': '$tipo_proceso.tipo', 
          },
         # Count the number instances in the group:         
         "cantidad_iniciados": {
            "$sum": 1
         },         
         'causa': {
            '$push': '$_id' # push con identificador dato primario
         }        
      }
   }, {
        '$lookup': {
            'from': 'organismos', 
            'localField': '_id.organismo_codigo', 
            'foreignField': 'codigo', 
            'as': 'datos_org'
        }
   }, {
      '$sort': {
         '_id.organismo':1
      }
   }
]

results = expedientes.aggregate(pipeline)
for i in results:
   pprint(i)

# CIniciadas primera instancia: filtrar por fecha inicio y facetar por grupos
# 
# jdos civiles, familia y laborales
# jdos paz
# cam cont adm
# garantías
# ....



# Agrupo por niveles arriba del tipo_proceso
[
    {
        '$match': {
            'inicio': {
                '$gte': datetime(2021, 2, 1, 0, 0, 0, tzinfo=timezone.utc), 
                '$lte': datetime(2021, 2, 28, 0, 0, 0, tzinfo=timezone.utc)
            }
        }
    }, {
        '$limit': 50000
    }, {
        '$addFields': {
            'firstElem': {
                '$arrayElemAt': [
                    '$tipo_proceso.padres', 0 # Primer Nivel
                ]
            }, 
            'secondElem': {
                '$arrayElemAt': [
                    '$tipo_proceso.padres', 1 # Segundo Nivel
                ]
            }
        }
    }, {
        '$group': {
            '_id': {
                'padre1': '$firstElem', 
                'padre2': '$secondElem'
            }, 
            'conteo': {
                '$sum': 1
            }
        }
    }, {
        '$sort': {
            'n': 1
        }
    }
]