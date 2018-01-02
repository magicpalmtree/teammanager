var express      = require('express');
var router       = express.Router();
var jsonwebtoken = require('jsonwebtoken');
const Mailer     = require('../helpers/mailer');
const TokenMaker = require('../helpers/tokenMaker');


var secretKey = process.env.TEAM_MANAGER_SECRET_KEY;

var tokenMaker = new TokenMaker(secretKey);
var mailer     = new Mailer();

var Member = require('../schema/member');
var User = require('../schema/user');
var Team = require('../schema/team');



router.post('/add', function(req, res, next) {

	

   	var member = new Member({
			team: req.body.team,
			user: req.body.user,
			
    });

	member.save(function(err) {
		if(err) {
			console.log("member save error: " + err);
			res.send(err);
			return;
		}
		console.log("member created");
	});

  res.json({ success: true, message: 'member created !', member: member});
});

//-----------------------------------------------------
//   Get Members
//-----------------------------------------------------
router.get('/all', function(req, res) {

	var user_id = req.decoded._id;
	console.log("get all members for user: " + user_id);

	Member.find( {manager: user_id})
	.populate('manager', ['_id', 'first_name', 'last_name', 'username'])
	.exec(function(err, members) {

		if(err) {
			res.send(err);
			return;
		}
		res.json(members);
	});
});

//-----------------------------------------------------
//   VERIFY
//-----------------------------------------------------
router.get('/verify/:token', function(req, res) {
	var token = req.params.token;

	console.log("Got verification token: " + token);

  	if(!token) {
  		res.send("No token found!");
  		return;
  	}

    jsonwebtoken.verify(token, secretKey, function(err, decoded){

            if(err) {
                res.send("Token verification failed!");
                return;
            } 

        // approving user
		Member.update({user: decoded._id}, {is_accepted: true}, function(err, numberAffected, rawResponse) {

			console.log("-- saved: " + err);
				if(err) res.send("Token verification failed!");
				else {

					//res.send("User verification Successfully!");

                    var parentDir  = __dirname.substring(0, __dirname.lastIndexOf('/'));

					res.sendFile(parentDir + '/public/views/general/verification_done.html') ;
			}
		})
             	
    });//jsonwebtoken

    

	//res.send("ok");
});

function sendInvitationEmail(req, email, token) {
    const subject = "Welcome to team manager";
    var html = "<b>Hi   </b><br>, <br> Welcome !!! <br> Team Manager is a perfect solution for managing your project and teams !!! <br>";

    html += "<br> Click on following link to verify your email.";

    // origin will tell localhost or server domain url's prefix
    var origin = req.get('origin'); 

    html += "<br><a href='" + origin + "/members/verify/" + token + "'>VERIFY ME</a>";

    html += "<br><br> Thanks <br> Team Manager Team";

    mailer.sendMail(email, subject, html);
}

//-----------------------------------------------------
//   INVITE USER TO TEAM
//-----------------------------------------------------
router.post('/invite_team_member', function(req, res) {
    var email = req.body.email;

    // console.log("[INFO] :: sending invitation to : " + email);


    // if user is not registered - check for email
    // send back error, user not found
    // ensure that user is not already registered

    User.findOne({
        email: req.body.email
            //}).select('password').exec(function(err, user) { // this will only select _id and password in user obj
        }).exec(function(err, user) {   //// this will select all fields in user obj

        if(err) throw err;

        if(!user) {
            res.send({ success: false, message: 'User does not exist !'});
            //res.status(403).send( {success: false, message: 'User does not exist !'});
        } else if(user) {

            //----------------------------------------------
            // before logging, ensure that user is verified
            //----------------------------------------------
            if(!user.is_verified) {

                console.log("------------ user not verified ----");

                res.send(JSON.stringify( { success: false, message: 'User is not verified, please check you email for verification. '} )  );
                //res.status(403).send( JSON.stringify( { success: false, message: 'User is not verified !'} )  );
                return; 
            }

             else {

                console.log("User  exists");

                //-------------------------
                // user exists , create token
                //-------------------------
                var token = tokenMaker.createUserToken(user);
                //req.session.user = user;
                

                // res.json({
                //     success: true,
                //     message: "User Exists",
                //     role: user.role,
                //     user_id: user._id,
                //     email: user.email,
                //     first_name: user.first_name,
                //     last_name: user.last_name,
                //     });

               
               
                res.json({ success: true, message: 'Invitation sent to ' + email}); 
                sendInvitationEmail(req, email, tokenMaker.createVerificationToken(user));
                

            }
        }
    });
    
    

    


   
});
module.exports = router;