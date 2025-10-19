// Controller for the home route
function getHome(req, res) {
  res.send('Hello World from Express! This is a public route.');
}

// Controller for the about route
function getAbout(req, res) {
  res.send('This is the public About page.');
}

module.exports = {
  getHome,
  getAbout,
};
