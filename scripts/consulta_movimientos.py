import pymongo
client = pymongo.MongoClient("10.101.2.97", 27017)
db = client.test
db.name

