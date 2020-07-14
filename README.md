User Accounts
=============

Basic user account management for the web.

Example & Getting Started
-------------------------

With Docker installed run the following:

```
./docker/docker-node npm install
./docker/docker-run
```

Access the site in your browser at [http://localhost:3000](http://localhost:3000). View email sent at `http://localhost:2525/`.

A full working example with skeleton templates is provided in the `./example` folder.

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

- `confirm-email` - email verification template.
- `recover-email` - account recovery template.
- `confirm-email-change-email` - email sent to new email address with confirmation link.
- `email-change-notification-email` - email sent to old email address to notify it that the account's address has changed.

All page template receive the following information so that a single template
could be imported into each template and used unmodified:

- `title` - the title for the page.
- `message` - an important message, but not an error or warning.
- `error` - an error message, indicating bad user input.
- `form` - an array or form fields.
- `errors` - field-specific error messages.
- `values` - current form field values.
- `registerUrl` - the registration URL with the return URL already encoded.
- `recoverUrl` - the account recovery URL with the return URL already encoded.

`form` contains an array of inputs that must be shown. The properties of each
element map exactly to properties of `input` elements with some exceptions:

- `label` should be rendered as the label to the input and not a property.
- `type` is limited to `hidden`, `text`, `email` and `password`.
- `errors` contains a map by input `name` to any error messages.
- `values` contains a map by input `name` to the current values, exactly as they should be rendered
into the `value` attribute.

All email templates contain a URL that must be rendered so that the user can
click on it to complete the given process.

The User Object
---------------

A user object is set that loosely conforms to the [Portal Contacts](https://tools.ietf.org/html/draft-smarr-vcarddav-portable-contacts-00#section-7.2) specification for an entry, as used by [Passport.js](http://www.passportjs.org/docs/profile/).

You can access this user in Express handlers in `req.user`.

The following values are provided:

    * `id` is the unique identifier, usually the original email the user signed up with but this may change in future.
    * `displayName` is derived from the name information provided by the user.
    * `name.familyName` as provided by the user.
    * `name.givenName` as provided by the user.
    * `name.middleName` as provided by the user but may be omitted.
    * `emails[0].value` is provided only, there is no support for more than one email or the email type at the moment.
