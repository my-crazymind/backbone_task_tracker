
/**
* MODULE DEPENDENCIES
* -------------------------------------------------------------------------------------------------
* include any modules you will use through out the file
**/
console.log('_____________________________________________________')
console.log(new Date());
var express = require('express')
  , less = require('less')
  , fs = require('fs')
  , connect = require('connect')
  , everyauth = require('everyauth')
  , nconf = require('nconf')
  , sys = require('util')
  , md5 = require('MD5')
  , Recaptcha = require('recaptcha').Recaptcha;
/**
* CONFIGURATION
* -------------------------------------------------------------------------------------------------
* load configuration settings from ENV, then settings.json.  Contains keys for OAuth logins. See 
* settings.example.json.  
**/
nconf.env().file({file: 'settings.json'});


/**
* EVERYAUTH AUTHENTICATION
* -------------------------------------------------------------------------------------------------
* allows users to log in and register using OAuth services
**/

everyauth.debug = true;

// Configure Facebook auth
var usersById = {},
    nextUserId = 0,
    usersByFacebookId = {},
    usersByTwitId = {},
    usersByLogin = {
        'admin@example.com': addUser({ email: 'admin@example.com', password: 'admin'})
    };




everyauth.
    everymodule.
    findUserById(function (id, callback) {
    callback(null, usersById[id]);
    });


/**
* FACEBOOK AUTHENTICATION
* -------------------------------------------------------------------------------------------------
* uncomment this section if you want to enable facebook authentication.  To use this, you will need
* to get a facebook application Id and Secret, and add those to settings.json.  See:
* http://developers.facebook.com/
**/

//everyauth.
//    facebook.
//    appId(nconf.get('facebook:applicationId')).
//    appSecret(nconf.get('facebook:applicationSecret')).
//    findOrCreateUser(
//  function(session, accessToken, accessTokenExtra, fbUserMetadata){
//      return usersByFacebookId[fbUserMetadata.claimedIdentifier] || 
//      (usersByFacebookId[fbUserMetadata.claimedIdentifier] = 
//       addUser('facebook', fbUserMetadata));
//  }).
//    redirectPath('/');


/**
* TWITTER AUTHENTICATION
* -------------------------------------------------------------------------------------------------
* uncomment this section if you want to enable twitter authentication.  To use this, you will need
* to get a twitter key and secret, and add those to settings.json.  See:
* https://dev.twitter.com/
**/

//everyauth
//  .twitter
//    .consumerKey(nconf.get('twitter:consumerKey'))
//    .consumerSecret(nconf.get('twitter:consumerSecret'))
//    .findOrCreateUser( function (sess, accessToken, accessSecret, twitUser) {
//      return usersByTwitId[twitUser.id] || (usersByTwitId[twitUser.id] = addUser('twitter', twitUser));
//    })
//    .redirectPath('/');



/**
* USERNAME & PASSWORD AUTHENTICATION
* -------------------------------------------------------------------------------------------------
* this section provides basic in-memory username and password authentication
**/

    everyauth
  .password
    .loginWith('email')
    .getLoginPath('/login')
    .postLoginPath('/login')
    .loginView('account/login')
    .loginLocals(function(req, res, done)
    {
        setTimeout(function()
        {
            done(null, {
                title: 'login.  '
            });
        }, 200);
    })
    .authenticate(function(login, password)
    {

        console.log(login);
        console.log(password);
        var errors = [];
        if(!login) errors.push('Missing login');
        if(!password) errors.push('Missing password');
        if(errors.length) return errors;
        var user = usersByLogin[login];
        
        
        console.log('usersByLogin: ', usersByLogin);
        console.log('user: ', user);


        //if(!user) return ['Login failed'];
        var dbcHeck = checkUser(usersList, login, password);
        if(!dbcHeck) return ['Login failed'];
        //if(user.password !== password) return ['Login failed'];
        return user;
    })
    .getRegisterPath('/register')
    .postRegisterPath('/register')
    .registerView('account/register')
    .registerLocals(function(req, res, done)
    {
        setTimeout(function()
        {
            done(null, {
                title: 'Register.  ',
                recaptcha_form: (new Recaptcha(nconf.get('recaptcha:publicKey'), nconf.get('recaptcha:privateKey'))).toHTML()
            });
        }, 200);
    })
    .extractExtraRegistrationParams(function(req)
    {
        return {
            confirmPassword: req.body.confirmPassword,
            data: {
                remoteip: req.connection.remoteAddress,
                challenge: req.body.recaptcha_challenge_field,
                response: req.body.recaptcha_response_field
            }
        }
    })
    .validateRegistration(function(newUserAttrs, errors)
    {
        var login = newUserAttrs.login;
        var confirmPassword = newUserAttrs.confirmPassword;
        if(!confirmPassword) errors.push('Missing password confirmation')
        if(newUserAttrs.password != confirmPassword) errors.push('Passwords must match');
        if(usersByLogin[login]) errors.push('Login already taken');

        // validate the recaptcha 
        var recaptcha = new Recaptcha(nconf.get('recaptcha:publicKey'), nconf.get('recaptcha:privateKey'), newUserAttrs.data);
        /* recaptcha.verify(function(success, error_code) {
        if(!success) {
        errors.push('Invalid recaptcha - please try again');
        }
        });*/

        //console.log('newUserAttrs: ', newUserAttrs);
        return errors;
    })
    .registerUser(function(newUserAttrs)
    {
        var login = newUserAttrs[this.loginKey()];
        return usersByLogin[login] = addUser(newUserAttrs);
    })
    .loginSuccessRedirect('/')
    .registerSuccessRedirect('/');

// add a user to the in memory store of users.  If you were looking to use a persistent store, this
// would be the place to start
function addUser (source, sourceUser) {
  var user;
  if (arguments.length === 1) {
    user = sourceUser = source;
    user.id = ++nextUserId;
    saveUserToDb(user);
    return usersById[nextUserId] = user;
  } else { // non-password-based
    user = usersById[++nextUserId] = {id: nextUserId};
    user[source] = sourceUser;
    saveUserToDb(user);
  }
  return user;
}

function saveUserToDb(user){
    return;
    if(dbConnection && user)
    {
        var salt = md5("!@#pwwd");
        var dbUser = 
        {
            name : user.email,
            id : user.id,
            hash : salt,
            pwd : md5(md5(user.password)+salt)
        }
        dbConnection.save('users', dbUser, resultHandler);
    }
}


var app = module.exports = express.createServer();

/**
* CONFIGURATION
* -------------------------------------------------------------------------------------------------
* set up view engine (jade), css preprocessor (less), and any custom middleware (errorHandler)
**/


app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(require('./middleware/locals'));
    app.use(express.cookieParser());
    app.use(express.session({ secret: 'azure zomg' }));
    app.use(everyauth.middleware());
    app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
    app.use(connect.static(__dirname + '/public'));
    app.use(app.router);
});

/**
* ERROR MANAGEMENT
* -------------------------------------------------------------------------------------------------
* error management - instead of using standard express / connect error management, we are going
* to show a custom 404 / 500 error using jade and the middleware errorHandler (see ./middleware/errorHandler.js)
**/
var errorOptions = { dumpExceptions: true, showStack: true }
app.configure('development', function() { });
app.configure('production', function() {
    errorOptions = {};
});
app.use(require('./middleware/errorHandler')(errorOptions));



/**
* ROUTING
* -------------------------------------------------------------------------------------------------
* include a route file for each major area of functionality in the site
**/

require('./routes/home')(app);
require('./routes/upload')(app);
require('./routes/mailer')(app);
require('./routes/account')(app);

// Global Routes - this should be last!
require('./routes/global')(app);




/* db connection */
var usersModel = require('./dbconnect').usersModel;
usersModel.findItems({}, saveUserHandler);


var datauser = 
{
    name : 'q@q.q',
    pwd : 'password update',
    hash : 'qweqwe'
}

console.log(usersModel);
usersModel.saveSingleItem(datauser, resultHandler);

function resultHandler(err, res){
    if(err){
        console.log(err);
    }else{
        console.log('resultHandler: ', res);
    }
}
var usersList;
function saveUserHandler(err, res){
    if(err){
        console.log(err);
    }else{
        usersList = res;
        //updateUserStack(usersList);
    }
}

function updateUserStack(usersList)
{
    for(var _i = 0; _i < usersList.length; _i++){
        usersByLogin[usersList[_i].name] = addUser({ email: usersList[_i].name, password: usersList[_i].pwd, id: usersList[_i].id });
    }
}

function checkUser(usersList, curr, pwd)
{
    if(usersList && curr && pwd){
        for(var _i = 0; _i<usersList.length; _i++){
          for(i in usersList[_i])
            {
                if(usersList[_i][i] == curr)
                {
                    console.log('match: ', usersList[_i]);
                    console.log('match: ', usersList[_i].pwd);
                    console.log('match: ', md5(md5(pwd) + usersList[_i].hash));
                    if(usersList[_i].pwd == md5(md5(pwd) + usersList[_i].hash)){
                        console.log('match: ', usersList[_i].pwd);
                        return true;
                    }
                }
            }
        }
        return false;
    }else
    {
        return false;
    }
}

/**
* CHAT / SOCKET.IO 
* -------------------------------------------------------------------------------------------------
* this shows a basic example of using socket.io to orchestrate chat
**/

// socket.io configuration
var buffer = [];
var io = require('socket.io').listen(app);


io.configure(function() {
    io.set("transports", ["xhr-polling"]);
    io.set("polling duration", 100);
});

io.sockets.on('connection', function(socket) {
    socket.emit('messages', { buffer: buffer });
    socket.on('setname', function(name) {
        socket.set('name', name, function() {
            socket.broadcast.emit('announcement', { announcement: name + ' connected' });
        });
    });
    socket.on('message', function(message) {
        socket.get('name', function(err, name) {
            var msg = { message: [name, message] };
            buffer.push(msg);
            if(buffer.length > 15) buffer.shift();
            socket.broadcast.emit('message', msg);
        })
    });
    socket.on('disconnect', function() {
        socket.get('name', function(err, name) {
            socket.broadcast.emit('announcement', { announcement: name + ' disconnected' });
        })
    })
});

/**
* RUN
* -------------------------------------------------------------------------------------------------
* this starts up the server on the given port
**/

everyauth.helpExpress(app);
app.listen(process.env.PORT || 3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

