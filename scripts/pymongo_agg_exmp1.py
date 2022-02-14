from matplotlib import collections
from pymongo import MongoClient
import pymongo
from pprint import pprint
from sklearn import pipeline
import datetime   # This will be needed later
import os

#client = MongoClient()
client = MongoClient('mongodb://m001-student:m001-mongodb-basics@cluster0-shard-00-00-jxeqq.mongodb.net:27017/?authSource=admin&replicaSet=Cluster0-shard-0&readPreference=primary&ssl=true')

# access bd and collections
for db_info in client.list_database_names():
    print(db_info)

bd = client["aggregations"]

collections = bd.list_collection_names()
for collection in collections:
    print(collection)

movies = bd['movies']

# Get the document with the title 'Blacksmith Scene':
pprint(movies.find_one({'title': 'Blacksmith Scene'}))

# Insertar Documento (no funcionó)
insert_result = movies.insert_one({
      "title": "Parasite",
      "year": 2020,
      "plot": "A poor family, the Kims, con their way into becoming the servants of a rich family, the Parks. "
      "But their easy life gets complicated when their deception is threatened with exposure.",
      "released": datetime(2020, 2, 7, 0, 0, 0),
   })

# try firs query
pipeline = [
  {
    '$match': {
      'awards': '/Won \d{1,2} Oscars?/'
    }
  },
  {
    '$group': {
      '_id': 'null',
      'highest_rating': { '$max': "$imdb.rating" },
      'lowest_rating': { '$min': "$imdb.rating" },
      'average_rating': { '$avg': "$imdb.rating" },
      'deviation': { '$stdDevSamp': "$imdb.rating" }
    }
  }
]

# ---
# https://www.mongodb.com/developer/quickstart/python-quickstart-aggregation/

pipeline = [
   {
      "$match": {
         "title": "A Star Is Born"
      }
   },
   {
      "$sort": {
         "year": pymongo.ASCENDING
      }
   },
]

results = movies.aggregate(pipeline)
for movie in results:
   print(" * {title}, {first_castmember}, {year}".format(
         title=movie["title"],
         first_castmember=movie["cast"][0],
         year=movie["year"],
   ))


# otra forma
# Match title = "A Star Is Born":
stage_match_title = {
   "$match": {
         "title": "A Star Is Born"
   }
}
# Sort by year, ascending:
stage_sort_year_ascending = {
   "$sort": { "year": pymongo.ASCENDING }
}
# Now the pipeline is easier to read:
pipeline = [
   stage_match_title,
   stage_sort_year_ascending,
]

results = movies.aggregate(pipeline)
for movie in results:
   print(" * {title}, {first_castmember}, {year}".format(
         title=movie["title"],
         first_castmember=movie["cast"][0],
         year=movie["year"],
   ))

# Look up related documents in the 'comments' collection:
stage_lookup_comments = {
   "$lookup": {
         "from": "comments",
         "localField": "_id",
         "foreignField": "movie_id",
         "as": "related_comments",
   }
}

# Limit to the first 5 documents:
stage_limit_5 = { "$limit": 5 }

pipeline = [
   stage_lookup_comments,
   stage_limit_5,
]

results = movies.aggregate(pipeline)
for movie in results:
   pprint(movie)


# Calculate the number of comments for each movie:
stage_add_comment_count = {
   "$addFields": {
         "comment_count": {
            "$size": "$related_comments"
         }
   }
}

# Match movie documents with more than 2 comments:
stage_match_with_comments = {
   "$match": {
         "comment_count": {
            "$gt": 2
         }
   }
}   

# Limit to the first 5 documents:
stage_limit_5 = { "$limit": 5 }

pipeline = [
   stage_lookup_comments,
   stage_add_comment_count,
   stage_match_with_comments,
   stage_limit_5,
]

results = movies.aggregate(pipeline)

for movie in results:
   print(movie["title"])
   print("Comment count:", movie["comment_count"])
   # Loop through the first 5 comments and print the name and text:
   for comment in movie["related_comments"][:5]:
         print(" * {name}: {text}".format(
            name=comment["name"],
            text=comment["text"]))


# Group movies by year, producing 'year-summary' documents that look like:
# {
#     '_id': 1917,
# }
stage_group_year = {
   "$group": {
         "_id": "$year",
   }
}

pipeline = [
   stage_group_year,
]
results = movies.aggregate(pipeline)

# Loop through the 'year-summary' documents:
for year_summary in results:
   pprint(year_summary)

stage_group_year = {
   "$group": {
         "_id": "$year",
         # Count the number of movies in the group:
         "movie_count": { "$sum": 1 },
         "movie_titles": { "$push": "$title" }
   }
}


stage_filter_year = {
    '$match': {
        'year': {
            '$gte': 2012
        }
    }
}    


pipeline = [
    stage_filter_year,
    stage_group_year
    ]


results = movies.aggregate(pipeline)

# Loop through the 'year-summary' documents:
for year_summary in results:
   pprint(year_summary)


