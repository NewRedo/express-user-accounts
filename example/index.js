"use strict";

const cookieParser = require("cookie-parser");
const express = require("express");
const multer = require("multer");
const os = require('os');
const path = require("path");
const ExpressUserAccounts = require("..");

const app = express();

app.set("view engine", "pug");

// Cookie parser with signing is required.
app.use(cookieParser("put-your-key-here"));
app.use("/accounts", multer().any());
app.use("/accounts", require("csurf")({
    cookie: true
}));

// Configure the user accounts module.
const userAccounts = new ExpressUserAccounts({
    // Path to your specific templates. Form structure for each function is
    // passed to the template via `res.locals`.
    templatePath: path.join(__dirname, "user-account-templates"),

    // Pluggable data-stores are supported, this uses CouchDB.
    store: new ExpressUserAccounts.PouchDbStore(path.join(os.homedir(), "users.pouchdb"))
});
app.use(userAccounts.createMiddleware());
app.use("/accounts", userAccounts.createUserInterface());

app.get("/", function(req, res, next) {
    res.locals.user = req.user;
    res.render(path.join(__dirname, "index"));
});

app.listen(3000);
console.warn("Listening on port 3000");