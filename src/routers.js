const ROUTE_PATHS = [
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => `/${letter}`),
  '/docs/guides/getting-started',
  '/users/:userId',
  '/organizations/:organizationId/projects/:projectId',
  '/files/*',
];

const fs = require('node:fs');
const path = require('node:path');

function pathsFor(dialect) {
  return ROUTE_PATHS.map((routePath) => {
    if (dialect === 'tanstack') {
      return routePath.slice(1)
        .replaceAll(/:([A-Za-z]+)/g, '$$$1')
        .replace('*', '$');
    }
    if (dialect === 'router5') return routePath.replace('*', '*splat');
    if (dialect === 'wouter2') return routePath.replace('*', ':splat*');
    return routePath;
  });
}

function versionOf(packageName) {
  let directory = path.dirname(require.resolve(packageName));
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (metadata.name) return metadata.version;
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Could not find package metadata for ${packageName}`);
}

function reactRouter5() {
  const packageName = 'react-router-v5';
  const { matchPath } = require(packageName);
  return {
    id: packageName,
    package: 'react-router',
    version: versionOf(packageName),
    match(pathname) {
      return ROUTE_PATHS.some((path) => matchPath(pathname, { path, exact: true }) !== null);
    },
  };
}

function modernReactRouter(packageName) {
  const { matchRoutes } = require(packageName);
  const routes = ROUTE_PATHS.map((path) => ({ path }));
  return {
    id: packageName,
    package: 'react-router',
    version: versionOf(packageName),
    match(pathname) {
      return matchRoutes(routes, pathname) !== null;
    },
  };
}

function remixRouter() {
  const packageName = '@remix-run/router';
  const { matchRoutes } = require(packageName);
  const routes = ROUTE_PATHS.map((path) => ({ path }));
  return {
    id: 'remix-router-v1',
    package: packageName,
    version: versionOf(packageName),
    match(pathname) {
      return matchRoutes(routes, pathname) !== null;
    },
  };
}

function router5() {
  const packageName = 'router5';
  const { createRouter } = require(packageName);
  const routes = pathsFor('router5').map((path, index) => ({
    name: `route-${index}`,
    path,
  }));
  const router = createRouter(routes);
  return {
    id: 'router5-v8',
    package: packageName,
    version: versionOf(packageName),
    match(pathname) {
      return router.matchPath(pathname) !== null;
    },
  };
}

function tanstackRouter() {
  const packageName = 'tanstack-router-v1';
  const {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
  } = require(packageName);
  const rootRoute = createRootRoute();
  const children = pathsFor('tanstack').map((path) => createRoute({
    getParentRoute: () => rootRoute,
    path,
  }));
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return {
    id: packageName,
    package: '@tanstack/react-router',
    version: versionOf(packageName),
    match(pathname) {
      return router.matchRoutes(pathname).length > 1;
    },
  };
}

function wouter2() {
  const packageName = 'wouter-v2';
  const makeMatcher = require(`${packageName}/matcher`).default;
  const matcher = makeMatcher();
  const routes = pathsFor('wouter2');
  return {
    id: packageName,
    package: 'wouter',
    version: versionOf(packageName),
    match(pathname) {
      return routes.some((path) => matcher(path, pathname)[0]);
    },
  };
}

async function wouter3() {
  const packageName = 'wouter-v3';
  const { matchRoute } = await import(packageName);
  const { parse } = await import('regexparam');
  return {
    id: packageName,
    package: 'wouter',
    version: versionOf(packageName),
    match(pathname) {
      return ROUTE_PATHS.some((path) => matchRoute(parse, path, pathname)[0]);
    },
  };
}

async function loadRouters() {
  return [
    reactRouter5(),
    modernReactRouter('react-router-v6'),
    modernReactRouter('react-router-v7'),
    remixRouter(),
    router5(),
    tanstackRouter(),
    wouter2(),
    await wouter3(),
  ];
}

module.exports = { loadRouters, ROUTE_PATHS };
