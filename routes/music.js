var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');

router.get('/', function(req, res, next) {
	var media = path.join(__dirname, '../public/media');

	fs.readdir(media, function(err, data) {
		if(err)	console.log(err);
		else {
			res.render('mc', {title :'Music', music: data});
		}
	});
});

module.exports = router;