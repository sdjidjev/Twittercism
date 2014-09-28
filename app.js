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
	var keys = Object.keys(tweets);
	for (var i = 0; i < keys.length; i++) {
		var tweet = tweets[keys[i]];
		var score = 0;
		if (tweet.text) {
			var textarr = tweet.text.toLowerCase().split(" ");
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
					choiceNegativeTweet = tweet.text;
					choiceNegativeTweetScore = score;
				}
				numNegatives++;
			} else if (score > 0) {
				if (score>choicePositiveTweetScore){
					choicePositiveTweet = tweet.text;
					choicePositiveTweetScore = score;
				}
				numPositives++;
			}
		}
	}
	return {
		choicePositiveTweet: choicePositiveTweet,
		choiceNegativeTweet: choiceNegativeTweet,
		numNegatives: numNegatives,
		numPositives: numPositives,
		totalTweets: keys.length,
	};
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
	if (isNaN(options.depth) || options.depth < 1) {
		options.depth = 1;
	}
	function loop(totalTweets, lastid, depth, callback) {
		if (depth > 0) {
			twitterSearch(options.search, function(data) {
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
		res.send(scoreTweets(data));
	});
});

app.listen(3000);