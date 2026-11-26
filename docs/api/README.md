# HTTP API and the Postman collection

`material-asus-router.postman_collection.json` lists every route of the app, grouped by area. It
is generated from the source by `node scripts/build-postman.mjs`, and `tests/postman.test.mjs`
fails when the running app has a route the collection does not list, or when the file is stale.

## Use it

1. Import the collection into Postman.
2. Set `baseUrl` to the app's address, for example `http://198.51.100.2:8790`.
3. Send **POST /api/login** with your app account. Postman keeps the session cookie.
4. Copy `csrf` from the answer into the `csrf` variable. Every request that changes something
   sends it in the `x-csrf` header.

## What to know

- Changing a router setting is two steps: **POST /api/changes/preview** returns a preview with an
  `id`, then **POST /api/changes/apply** with that `previewId`. A change rated level 1 or more
  needs the four-key confirmation first (see `/api/safety`).
- Viewers can only read; operators can change settings; only the owner manages people, the router
  connection, keys and saved routers.
- No route ever returns a router password or private key.
- **GET /api/unkick** and **POST /api/unkick** need no account: they only read or lift a pause on
  the device that sends the request, and the POST needs the header `x-unkick: 1`.
