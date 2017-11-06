User Accounts
=============

Basic user account management for the web.

```
// Cookie parser with signing is required.
app.use(cookieParser(
    crypto.randomBytes(1024).toString("base64")
));

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
```

Templates
---------

You must supply the following page templates:

`login` - the login form.
`register` - the registration form.
`register-pending` - after the email verification email has gone out.
`recover` - account recovery form.
`recover-pending` - after the account recovery email has gone out.
`recover-complete` - form used to complete the recovery process.

You must supply the following email templates:

`confirm-email` - email verification template.
`recover-email` - account recovery template.
`confirm-email-change-email` - email sent to new email address with confirmation link.
`email-change-notification-email` - email sent to old email address to notify it that the account's address has changed.

All page template receive the following information so that a single template
could be imported into each template and used unmodified:

`title` - the title for the page.
`message` - an important message, but not an error or warning.
`error` - an error message, indicating bad user input.
`form` - an array or form fields.
`errors` - field-specific error messages.
`values` - current form field values.
`registerUrl` - the registration URL with the return URL already encoded.
`recoverUrl` - the account recovery URL with the return URL already encoded.

`form` contains an array of inputs that must be shown. The properties of each
element map exactly to properties of `input` elements with some exceptions:

* `label` should be rendered as the label to the input and not a property.
* `type` is limited to `hidden`, `text`, `email` and `password`.

`errors` contains a map by input `name` to any error messages. `values` contains
a map by input `name` to the current values, exactly as they should be rendered
into the `value` attribute.

All email templates contain a URL that must be rendered so that the user can
click on it to complete the given process.
