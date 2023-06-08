const jsdom = require('jsdom');

const packageJson = require('./package.json');
const reactRouterDom6Versions = Object.keys(packageJson.devDependencies).filter((key) => key.startsWith('react-router-dom_6'));
// randomize the order of reactRouterDom6Versions
reactRouterDom6Versions.sort(() => Math.random() - 0.5);

const tanstackRouter = require('@tanstack/router');
// console.log(reactRouterDom5, reactRouterDom6, tanstackRouter);

const WINDOW_LOCATION_HREF = 'https://localhost:3000';
const TEST_RUNS = 10000;

global.Request = function Request() {};
function setupDom() {
  const { JSDOM } = jsdom;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  dom.reconfigure({ url: WINDOW_LOCATION_HREF });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.document.defaultView = dom.window;
  global.navigator = {
    userAgent: 'node.js',
  };
}

async function benchmarkReactRouter6(reactRouterDom6Version) {
  const reactRouterDom6 = require(reactRouterDom6Version);
  setupDom();
  const paths = "abcdefghijklmnopqrstuvwxyz".split("").map((letter) => {
    return {
      path: `/${letter}`,
      element: jsdom.JSDOM.fragment(`<div>${letter}</div>`)
    }
  });
  const router = reactRouterDom6.createBrowserRouter([
    {
      path: '/',
      element: jsdom.JSDOM.fragment('<div>Root</div>')
    },
    ...paths
  ]);
  const timeLabel = reactRouterDom6Version;
  // console.log(router.routes);
  
  console.profile(timeLabel);
  console.time(timeLabel + ': root');
  for (let i = 0; i < TEST_RUNS; i++) {
    await router.navigate('/');
  }
  console.timeEnd(timeLabel + ': root');
  console.time(timeLabel + ': non-existent path');
  for (let i = 0; i < TEST_RUNS; i++) {
    await router.navigate('/does-not-exist');
  }
  console.timeEnd(timeLabel + ': non-existent path');
  console.profileEnd(timeLabel);
}

async function benchmarkReactRouter5() {
  const React = require('react');
  console.log("Benchmarking react router v5");
  setupDom();
  // when react router v5 is imported, it requires the global window and document createElement to exist upon import
  const reactRouterDom5 = require('react-router-dom5');
  const link = React.createElement(reactRouterDom5.Link, { to: '/' });
  const route = React.createElement(reactRouterDom5.Route, {
    path: '/',
    element: jsdom.JSDOM.fragment('<div>Root</div>')
  });
  const _switch = React.createElement(reactRouterDom5.Switch, {
    children: [route]
  });
  const router = React.createElement(reactRouterDom5.BrowserRouter, {
    children: [link, _switch]
  });
  console.log(link);
  console.time('react-router-v5');
  for (let i = 0; i < TEST_RUNS; i++) {
    /*
    navigate: function navigate() {
        var location = resolveToLocation(to, context.location);
        var isDuplicateNavigation = history.createPath(context.location) === history.createPath(normalizeToLocation(location));
        var method = replace || isDuplicateNavigation ? history$1.replace : history$1.push;
        method(location);
      }
    */
  }
  console.timeEnd('react-router-v5');
}

reactRouterDom6Versions.reduce((promise, reactRouterDom6Version) => {
  return promise.then(() => {
    return benchmarkReactRouter6(reactRouterDom6Version);
  });
}, Promise.resolve());
// benchmarkReactRouter5();
