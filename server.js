'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'public');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end('Forbidden'); }
  try { if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); }
  catch { file = path.join(root, 'index.html'); }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {'Content-Type':types[ext] || 'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(file).pipe(res);
});
const port = Number(process.env.PORT) || 10000;
server.listen(port, '0.0.0.0', () => console.log('NERO Tube listening on ' + port));
