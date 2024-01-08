// Contains data for all form validations
const y = require("yup");
const { URL, parse: parseURL } = require("url");

function checkWhiteSpace(string) {
  return this.test("checkWhiteSpace", string, function (value) {
    const { path, createError } = this;
    if (!value.split("\n").join("").split(" ").join(""))
      return createError({ path, message: "Please enter a message" });
    return true;
  });
}

function noPluses(string) {
  return this.test("noPluses", string, function (value) {
    const { path, createError } = this;
    if (value.split("+").length > 1)
      return createError({ path, message: "Invalid characters detected" });
    return true;
  });
}

function validURL(string) {
  return this.test("validURL", string, function (value) {
    const { path, createError } = this;
    try {
      const parsed = parseURL(value);
      if (!parsed.protocol) value = "https://" + value;
      new URL(value);
      return true;
    } catch (err) {
      console.log("error", err);
      return createError({ path, message: "Please enter a valid url" });
    }
  });
}

y.addMethod(y.string, "checkWhiteSpace", checkWhiteSpace);
y.addMethod(y.string, "noPluses", noPluses);
y.addMethod(y.string, "validURL", validURL);

const link_schema = y.object().shape({
  text: y.string().required("Please enter text"),
  link: y
    .string()
    .validURL("Please enter a valid URL")
    .required("Please enter a URL"),
});

const live_title_schema = y.object().shape({
  streamTitle: y.string().max(50, "Title is too long (max: 50 chars)"),
});

const user_schema = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric")
    .notOneOf(
      [
        "search",
        "info",
        "logs",
        "login",
        "forgot-password",
        "check-email",
        "awaiting-approval-email",
        "awaiting-approval",
        "received",
        "validate-email",
        "create-account",
        "messages",
        "contact",
        "reports",
        "notifications",
        "not-found",
        "null",
      ],
      "Please choose a different username"
    ),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  password1: y
    .string()
    .min(4, "Password is too short (min: 4 characters)")
    .max(256, "Password is too long (max: 256 characters)")
    .required("Please enter a password"),
  password2: y
    .string()
    .oneOf([y.ref("password1"), null], "Passwords must match")
    .required("Please confirm your password"),
  displayName: y
    .string()
    .min(1, "Please enter a Display Name")
    .max(50, "Display Name is too long (max: 50 chars)"),
  location: y.string().max(50, "Location is too long (max: 50 chars)"),
  website: y.string().max(100, "Website is too long (max: 100 chars)"),
});

const edit_user_schema = y.object().shape({
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  displayName: y
    .string()
    .min(1, "Please enter a Display Name")
    .max(50, "Display Name is too long (max: 50 chars)"),
  location: y.string().max(50, "Location is too long (max: 50 chars)"),
  website: y.string().max(100, "Website is too long (max: 100 chars)"),
  // bio: y.string().max(1000, 'Bio is too long (Max: 1000 chars)')
});

const edit_user_mod_schema = y.object().shape({
  displayName: y
    .string()
    .min(1, "Please enter a Display Name")
    .max(50, "Display Name is too long (max: 50 chars)"),
  location: y.string().max(50, "Location is too long (max: 50 chars)"),
  website: y.string().max(100, "Website is too long (max: 100 chars)"),
});

const poll_schema = y.object().shape({
  question: y
    .string()
    .max(120, "Question is too long (max: 120 characters)")
    .required("Please enter a question"),
  votesAllowed: y
    .number("Votes allowed must be numeric")
    .required("Please indicate the number of votes allowed"),
  noExpiry: y.boolean(),
  expiryUnits: y.string().oneOf(["minute", "hour", "day", "month", "year"]),
  expiryLength: y
    .number()
    .positive("Please enter a positive number for the expiration length")
    .min(1, "Please enter a positive number for the expiration length"),
});

const option_schema = y.object().shape({
  option: y
    .string()
    .max(120, "Option is too long (max: 120 characters)")
    .required("Please enter an option"),
});

const poll_schema_server = y.object().shape({
  question: y
    .string()
    .max(120, "Question is too long (max: 120 characters)")
    .required("Please enter a question"),
  votesAllowed: y
    .number("Votes allowed must be numeric")
    .required("Please indicate the number of votes allowed"),
  options: y
    .array()
    .of(
      y
        .string()
        .max(120, "Option is too long (max: 120 characters)")
        .required("Please enter an option")
    )
    .min(2)
    .required(),
  expirationInfo: y.object().shape({
    expiryLength: y
      .number()
      .positive("Please enter a positive number for the expiration length")
      .min(1, "Please enter a positive number for the expiration length"),
    expiryUnits: y.string().oneOf(["hour", "day", "week", "month", "year"]),
  }),
});

const edit_chadmin_schema = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  comments: y.string().max(500, "Comments are too long (max: 500 characters)"),
});

const user_schema_chadmin = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  comments: y.string().max(500, "Comments are too long (max: 500 characters)"),
});

const edit_janny_schema = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  comments: y.string().max(500, "Comments are too long (max: 500 characters)"),
});

const user_schema_janny = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  comments: y.string().max(500, "Comments are too long (max: 500 characters)"),
});

const edit_verified_schema = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  comments: y.string().max(500, "Comments are too long (max: 500 characters)"),
});

const user_schema_verified = y.object().shape({
  username: y
    .string()
    .min(4, "Username is too short (min: 4 characters)")
    .max(30, "Username is too long (max: 30 characters)")
    .required("Please enter a username")
    .matches(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  comments: y.string().max(500, "Comments are too long (max: 500 characters)"),
});

const change_password_schema = y.object().shape({
  current_password: y.string().required("Please enter your password"),
  password1: y
    .string()
    .min(4, "Password is too short (min: 4 characters)")
    .max(256, "Password is too long (max: 256 characters)")
    .required("Please enter a new password"),
  password2: y
    .string()
    .oneOf([y.ref("password1"), null], "Passwords must match")
    .required("Please confirm your password"),
});

const change_password_uuid_schema = y.object().shape({
  password1: y
    .string()
    .min(4, "Password is too short (min: 4 characters)")
    .max(256, "Password is too long (max: 256 characters)")
    .required("Please enter a new password"),
  password2: y
    .string()
    .oneOf([y.ref("password1"), null], "Passwords must match")
    .required("Please confirm your password"),
});

const forgot_password_schema = y.object().shape({
  username: y.string().required("Please enter your username"),
  email: y.string().required("Please enter your email address"),
});

const user_update_schema = y.object().shape({
  email: y
    .string()
    .min(4, "Email is too short (min: 4 characters)")
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address")
    .noPluses("Invalid characters in email"),
  bio: y.string().max(1000, "Bio is too long (Max: 1000 chars)"),
});

const login_schema = y.object().shape({
  username: y.string().required("Please enter a username"),
  password: y.string().required("Please enter a password"),
});

const contact_form_schema = y.object().shape({
  email: y
    .string()
    .max(256, "Email is too long (max: 256 characters)")
    .email("Invalid email")
    .required("Please enter an email address"),
  name: y
    .string()
    .max(50, "Name is too long (max: 50 characters)")
    .required("Please enter your name"),
  subject: y
    .string()
    .max(150, "Subject is too long (max: 150 characters)")
    .required("Please enter a subject"),
  message: y
    .string()
    .max(10000, "Message is too long (max: 10000 characters)")
    .required("Please enter a message"),
});

const image_schema = y.object().shape({
  name: y.string().max(50, "Name is too long (max: 50 characters)"),
  manifesto: y
    .string()
    .max(10000, "Manifesto is too long (max: 10000 characters)"),
});

const comment_schema = y.object().shape({
  name: y.string().max(50, "Name is too long (max: 50 characters)"),
  body: y
    .string()
    .max(10000, "Body is too long (max: 10000 characters)")
    .required("Please enter a message")
    .checkWhiteSpace("Please enter a message"),
});

const report_schema = y.object().shape({
  details: y
    .string()
    .max(200, "Report reason is too long (max: 200 characters)")
    .required("Please enter a reason")
    .checkWhiteSpace("Please enter a reason"),
});

module.exports = {
  link_schema,
  live_title_schema,
  user_schema,
  edit_user_schema,
  edit_user_mod_schema,
  poll_schema,
  option_schema,
  poll_schema_server,
  edit_chadmin_schema,
  user_schema_chadmin,
  edit_janny_schema,
  user_schema_janny,
  edit_verified_schema,
  user_schema_verified,
  change_password_schema,
  change_password_uuid_schema,
  forgot_password_schema,
  user_update_schema,
  login_schema,
  contact_form_schema,
  image_schema,
  comment_schema,
  report_schema,
};
