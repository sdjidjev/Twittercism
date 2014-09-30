var http = require('http');
var config = require('./config.json');
var positiveWords = require('./positive-words.json');
var negativeWords = require('./negative-words.json');
var Twit = require('twit');

var T = new Twit({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token: config.twitter.access_token,
    access_token_secret: config.twitter.access_token_secret
});
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var rootDir = __dirname;

app.set('views', rootDir + '/views');
app.set('view engine', 'ejs');
app.set("view options", {layout: false});

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// Serve static content from "public" directory
app.use(express.static(rootDir +'/public'));

app.get('/',function(req,res){
	res.render('index');
});

var cache = {};

function scoreTweets(tweets,name) {
	var numPositives = 0;
	var numNegatives = 0;
	var positiveTweets = [];
	var negativeTweets = [];
	var keys = Object.keys(tweets);
	for (var i = 0; i < keys.length; i++) {
		var tweet = tweets[keys[i]];
		var score = 0;
		if (tweet.text && 
			tweet.text.substring(0,4) != "RT @" && 
			tweet.user.screen_name.toLowerCase().indexOf(name.toLowerCase()) == -1) {
			var tweetText = tweet.text.replace(/[.,!?]/g, '');
			var textarr = tweetText.toLowerCase().split(" ");
			for (var j = 0; j < textarr.length; j++) {
				if (positiveWords[textarr[j]]) {
					score++;
				}
				if (negativeWords[textarr[j]]) {
					score--;
				}
			}
			if (score < 0) {
				negativeTweets.push(tweet);
				numNegatives++;
			} else if (score > 0) {
				positiveTweets.push(tweet);
				numPositives++;
			}
		}
	}
	return {
		positiveTweets: positiveTweets,
		negativeTweets: negativeTweets,
		numNegatives: numNegatives,
		numPositives: numPositives,
		totalTweets: keys.length,
	};
}

function twitterSearch(searchQuery,callback,maxID){
	var query = {q: searchQuery, count: 100, result_type: 'recent'};
	if (maxID !== undefined) {
		query.max_id = maxID;
	}
	T.get('search/tweets', query, function(err,data,response){
		if (data) {
			var statuses = data.statuses;
			var lowestTweet;

			for (var i = 0; i < statuses.length; i++) {
				if (lowestTweet === undefined || statuses[i].id < lowestTweet) {
					lowestTweet = statuses[i].id;
				}
			}
			
			callback({
				tweets: statuses,
				lastTweetId: lowestTweet
			});
		} else {
			console.log('Twitter done broke!!!');
			callback({
				tweets: [],
				lastTweetId: 0
			});
		}
	});
}

function getIMDBMovie(search, callback) {
	http.get('http://www.omdbapi.com/?s='+search, function(IMDBSearchRes) {
		var result = "";
		IMDBSearchRes.on('data', function (chunk) {
			result += chunk;
		});
		IMDBSearchRes.on('end', function() {
			var resultJSON = JSON.parse(result);
			if (resultJSON.Search && resultJSON.Search.length > 0) {
				http.get('http://www.omdbapi.com/?i='+resultJSON.Search[0].imdbID, function(IMDBMovieRes) {
					var result = "";
					IMDBMovieRes.on('data', function (chunk) {
						result += chunk;
					});
					IMDBMovieRes.on('end', function() {
						var resultJSON = JSON.parse(result);
						callback(resultJSON);
					});
				});
			} else {
				console.log("No movie found for "+search+"!!!");
				callback({Title:search,Year:'',Rated:'',Released:'',Runtime:'',Genre:'',Director:'',Writer:'',Actors:'',Plot:'',Language:'',Country:'',Awards:'',Poster:'',Metascore:'',imdbRating:'',imdbVotes:'',imdbID:'',Type:'',Response:''});
			}
		});
	});
}

app.post('/search',function(req,res) {
	var options = req.body;
	if (isNaN(options.depth) || options.depth < 1) {
		options.depth = 1;
	}
	getIMDBMovie(options.search, function(movieJSON) {
		var name = movieJSON.Title;

		if (cache[movieJSON.imdbID]){
			res.send(cache[movieJSON.imdbID]);
		}
		else {
			function loop(totalTweets, lastid, depth, callback) {
				if (depth > 0) {
					twitterSearch(name, function(data) {
						for (var i = 0; i < data.tweets.length; i++) {
							if (!totalTweets[data.tweets[i].id]) {
								totalTweets[data.tweets[i].id] = data.tweets[i];
							}
						}
						loop(totalTweets, data.lastTweetId, depth-1, callback);
					}, lastid);
				} else {
					callback(totalTweets);
				}
			}
			loop({}, undefined, options.depth, function(data) {
				cache[movieJSON.imdbID] = {
					scoreData: scoreTweets(data,name),
					movieJSON: movieJSON
				};
				res.send(cache[movieJSON.imdbID]);
			});
		}
	});
});

app.listen(3000);