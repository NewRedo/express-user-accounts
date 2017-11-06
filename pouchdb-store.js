// Copyright (c) 2017 NewRedo Ltd.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

"use strict";

const extend = require("extend");
const PouchDb = require("pouchdb");
const async = require("async");

class PouchDbStore {
    constructor(options) {
        this._db = new PouchDb(options);
        this._db.get("_design/email", (err, doc) => {
            const view = {
                "_id": "_design/email",
                "language": "javascript",
                "views": {
                    "default": {
                        "map": (function(doc) {
                            if (doc.emails) {
                                doc.emails.forEach(function(email) {
                                    if (email.value) emit(email.value, null);
                                });
                            }
                        }).toString()
                    }
                }
            };
            if (doc) view._rev = doc._rev;
            this._db.put(view);
        });
    }

    /*
    Gets a user record.

    `id` - The unique identifier of the user.
    `callback` - a `function(err, user)` called on completion.
    */
    get(id, callback) {
        this._db.get(id, (err, doc) => {
            if (!err) {
                doc.id = doc._id;
                delete doc._id;
                delete doc._rev;
            }
            callback(err, doc);
        });
    }

    /*
    Creats or updates a user record.

    `obj` - record.
    `obj.id` - the identifier of the user.
    `calllback` - a `function(err)` that is called on completion.
    */
    put(obj, callback) {
        obj = extend({}, obj);
        obj._id = obj.id;
        delete obj.id;

        this._db.get(obj._id, (err, user) => {
            if (!err) {
                obj._rev = user._rev
                this._db.put(obj, err => callback(err));
            } else if (err.status === 404) {
                this._db.put(obj, err => callback(err));
            } else {
                callback(new Error(JSON.stringify(err)));
            }
        });
    }

    /*
    Gets a user record by email address.

    `email` - The email address of the user.
    `callback` - a `function(err, user)` called on completion.
    */
    findByEmail(email, callback) {
        this._db.query(
            "email/default", {
                key: email,
                include_docs: true
            },
            function(err, result) {
                if (err) throw err;
                if (result.rows.length > 1) {
                    callback(new Error("More than one account with same email address."));
                } else if (result.rows.length) {
                    var doc = result.rows[0].doc;
                    doc.id = doc._id;
                    delete doc._id;
                    delete doc._rev;
                    callback(null, doc);
                } else {
                    callback(null, null);
                }
            }
        );
    }
}

module.exports = PouchDbStore;
