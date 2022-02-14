from matplotlib import collections
from pymongo import MongoClient
import pymongo
from pprint import pprint
from sklearn import pipeline
import datetime   # This will be needed later
import os


CHANGE_STREAM_DB = "mongodb+srv://user:<password>@example-xkfzv.mongodb.net/test?retryWrites=true"

#client = MongoClient()
client = MongoClient('mongodb://m001-student:m001-mongodb-basics@cluster0-shard-00-00-jxeqq.mongodb.net:27017/?authSource=admin&replicaSet=Cluster0-shard-0&readPreference=primary&ssl=true')
