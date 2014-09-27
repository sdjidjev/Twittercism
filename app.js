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

function scoreTweets(tweets) {
	var numPositives = 0;
	var numNegatives = 0;
	var choicePositiveTweet = "";
	var choicePositiveTweetScore = 0;
	var choiceNegativeTweet = "";
	var choiceNegativeTweetScore = 0;
	for (var i = 0; i < statuses.length; i++) {
		var score = 0;
		if (statuses[i].text) {
			var textarr = statuses[i].text.toLowerCase().split(" ");
			for (var j = 0; j < textarr.length; j++) {
				if (positiveWords[textarr[j]]) {
					score++;
				}
				if (negativeWords[textarr[j]]) {
					score--;
				}
			}
			if (score < 0) {
				if (score<choiceNegativeTweetScore){
					choiceNegativeTweet = statuses[i].text;
					choiceNegativeTweetScore = score;
				}
				numNegatives++;
			} else if (score > 0) {
				if (score>choicePositiveTweetScore){
					choicePositiveTweet = statuses[i].text;
					choicePositiveTweetScore = score;
				}
				numPositives++;
			}
		}
	}
}

function twitterSearch(searchQuery,callback,maxID){
	var query = {q: searchQuery, count: 100};
	if (maxID !== undefined) {
		query.max_id = maxID;
	}
	T.get('search/tweets', query, function(err,data,response){
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
	});
}

app.post('/search',function(req,res){
	var options = req.body;
	if (options.depth > 0) {
		function loop(totalTweets, lastid, depth, callback) {
			if (depth > 0) {
				twitterSearch(options.search, function(data) {
					for (var i = 0; i < data.tweets.length; i++) {
						if (!totalTweets[data.tweets[i].id]) {
							totalTweets[data.tweets[i].id] = data.tweets[i];
						}
					}
					loop(totalTweets, data.lastTweetId, depth-1, callback);
				});
			} else {
				callback(totalTweets);
			}
		}
		loop({}, undefined, options.depth, function(data) {
			res.send(data);
		});
	} else {
		twitterSearch(options.search, function(data) {
			res.send([data]);
		});
	}
});

app.listen(3000);