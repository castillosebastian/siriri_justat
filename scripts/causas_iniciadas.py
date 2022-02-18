#%% Libraries
# Data manipulation and Viz
import pandas as pd
import numpy as np
import os
import nltk
# data visualization
import matplotlib.pyplot as plt
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


#%% client = MongoClient()
client = MongoClient('mongodb://10.101.2.97:27017/?readPreference=primary&ssl=false')
bd = client["expedientes_production"]
collections = bd.list_collection_names()
expedientes = bd['expedientes'] 
for collection in collections:
    print(collection)
 
#%% Variables
from datetime import datetime
start_date = datetime(2021, 2, 1)
end_date = datetime(2021, 2, 28)

#%% Analizando estadística de consulta 

# expedientes.create_index('inicio') # SE CREO INDICE SOBRE 'INICIADOS'

#%% Get the documents betwen dates:
pipeline = [
   {
      "$match": {
         "inicio": {
            '$gte': start_date,
            '$lte': end_date
         }
      }
   }, {
      "$group": {
         "_id": {
            'organismo': '$lex_id.codigo_organismo',            
            'tipo_proceso': '$tipo_proceso.tipo'
            },
         # Count the number instances in the group:         
         "cantidad_iniciados": {
             "$sum": 1
             }, 
         'causa': {
            '$addToSet': '$nro'
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
   print(i)


##############################
# TO DO
##############################
#%% Look up 
# Procesamiento por Grupo de Proceso
stage_lookup_comments = {
   "$lookup": {
         "from": "comments",
         "localField": "_id",
         "foreignField": "movie_id",
         "as": "related_comments",
   }
}
results = movies.aggregate(pipeline)
for movie in results:
   pprint(movie)

#%% Calculate the number of movimientos:
stage_conteo_movimientos = {
   "$addFields": {
         "movimientos_periodo": {
            "$size": "$movimientos"
         }
   }
}

#%% Match documents with more than 2 movimientos:
stage_match_with_comments = {
   "$match": {
         "comment_count": {
            "$gt": 2
         }
   }
}   

#%% Limit to the first 5 documents:
stage_limit_5 = { "$limit": 5 }
for movie in results:
   print(movie["title"])
   print("Comment count:", movie["comment_count"])
   # Loop through the first 5 comments and print the name and text:
   for comment in movie["related_comments"][:5]:
         print(" * {name}: {text}".format(
            name=comment["name"],
            text=comment["text"]))