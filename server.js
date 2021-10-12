import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import mongoose from "mongoose";
import session from 'express-session';
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import GoogleStrategy from 'passport-google-oauth20';
GoogleStrategy.Strategy
import findOrCreate from 'mongoose-findorcreate';
import password from 'generate-password';
import md5 from 'md5';
import nodemailer from 'nodemailer';


const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Secret Notes",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
// mongoose.set("useCreateIndex", true);
const notesSchema = new mongoose.Schema({
  anote: String,
  password: String,
  number: Number,
})

const Note = new mongoose.model("Note", notesSchema)


const userSchema = new mongoose.Schema({
  googleId: String,
  username: String,
  picture: String,
  fname: String,
  notes: [notesSchema], 
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
var currentid = "";

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});




passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/notes",
    // callbackURL: "https://notejournal.herokuapp.com/auth/google/notes",
    // callbackURL: "https://limitless-sands-05271.herokuapp.com/auth/google/notes",
    // callbackURL: "https://morning-everglades-21513.herokuapp.com/auth/google/notes",
    // callbackURL: "https://pacific-savannah-75315.herokuapp.com/auth/google/notes",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback: true,
  },
  function (req, accessToken, refreshToken, profile, cb) {
    console.log(profile);
    currentid = profile.id;
    req.session.new=profile.id;
    req.session.email = profile.emails[0].value;

    User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id, picture: profile.photos[0].value, fname: profile.displayName }, function (err, user) {
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken
        return cb(err, user);
    });
}
));

app.route("/")
    .get((req, res) => {
        res.render("index");
    })


app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', "email"] }));

app.get("/auth/google/notes",
    passport.authenticate('google', { failureRedirect: "/" }),
    function (req, res) {
        res.redirect("/notes");
    });


app.get("/notes", function(req,res){
  if(req.isAuthenticated()){
    User.findOne({ googleId: req.session.new}, async function(err, foundUser) {
      if(err) {
        console.log(err);
      }else{
        res.render("notes", {notes: foundUser.notes})
      }

  })
}})



app.post("/notes", function(req,res){
  const anote = req.body.note;
  const onepassword = password.generate({
    length: 10,
    numbers: true
  });
  console.log(onepassword);
  
  const note = new Note({
    anote: anote,
    password: md5(onepassword),
    number: 0
  })

  let conf = ``;

  conf = `
  <div style="background-color: #efdbdd">
        <h1 style="text-align: center">Password for your recent note is </h1>
          <p style="font-size:1.2em ; text-align: center;"><b>Password:</b> ${onepassword}</p>
          <p style="text-align: center;">This is an auto-generated mail. Please do not reply.</p>
          </div>
  `
  let transporter = nodemailer.createTransport({
    service: 'gmail',

    port: 587,
    secure: false,
    auth: {
        user: 'notejournal.iiti@gmail.com',
        pass: process.env.PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    }
});

let mailOptions = {
  from: '"Note Journal" <notejournal.iiti@gmail.com>',
  to: req.session.email,
  subject: 'Note added',
  text: 'Hello world?',
  html: conf
};
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
      return console.log(error);
  }
  console.log('Message sent: %s', info.messageId);
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

  res.render('contact', { msg: 'Email has been sent' });
});

  
  User.findOne({ googleId: req.session.new}, function(err, foundUser) {
  

    foundUser.notes.push(note);
    foundUser.save();
    res.render("notes", {passwordf : onepassword});
  });


  console.log(note);
})

app.post("/check", function(req,res){
  const checkpass = md5(req.body.Password);
  User.findOne({ googleId: req.session.new}, function(err, foundUser) {
    let ans;
    let bool = false;
    for(let i=0; i<foundUser.notes.length; i++){
      if(checkpass === foundUser.notes[i].password){
        // console.log(foundUser.notes[i].anote);
        ans = foundUser.notes[i].anote;
        bool=true;
      }

    }
    if(bool===false){
      ans = "Password Invalid";
    }
    res.render("check", {ans: ans});
  });


})

app.listen(process.env.PORT || 5000, ()=>{
    console.log("Connection established on port 5000")
})