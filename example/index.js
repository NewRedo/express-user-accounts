"use strict";

const userAccounts = require("..");
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");

const app = express();

app.set("view engine", "pug");

// Cookie parser with signing is required.
app.use(cookieParser("put-your-key-here"));
app.use("/accounts", multer().any());
app.use("/accounts", require("csurf")({ cookie: true }));

// Configure the user accounts module.
app.use(userAccounts({
    // User account related functions will be mounted here, but req.user will
    // be set everywhere.
    mountPoint: "/accounts",

    // Path to your specific templates. Form structure for each function is
    // passed to the template via `res.locals`.
    templatePath: path.join(__dirname, "user-account-templates"),

    // Pluggable data-stores are supported, this uses CouchDB.
    store: new userAccounts.PouchDbStore("http://localhost:5984/users")
}));

app.get("/", function (req, res, next) {
    res.locals.user = req.user;
    res.render(path.join(__dirname, "index"));
});

app.listen(3000);
console.warn("Listening on port 3000");
