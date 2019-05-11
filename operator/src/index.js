var http = require('http')
var createHandler = require('github-webhook-handler')
//var handler = createHandler({ path: '/' + process.env.WEBHOOK_PATH, secret: process.env.WEBHOOK_SECRET })
var handler = createHandler({ path: '/webhook', secret: 'supersecret' })

const K8s = require('easy-k8s').Client;
const config = require('kubernetes-client').config
kubeconfig = config.getInCluster()

async function testPod()
{
  const payloadSpec = await K8s.get(kubeconfig, 'default', 'payloads');
  console.log(payloadSpec)
}

testPod();

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404
    res.end('no such location')
  })
}).listen(8080)
 
handler.on('error', function (err) {
  console.error('Error:', err.message)
})
 
handler.on('push', async function (event) {
  console.log('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref)
    /*
    const create = await client.apis["hook-to-k8s.sfxworks.net"].v1.namespaces.default.payloads.post({ body: {
      "apiVersion": "hook-to-k8s.sfxworks.net/v1",
      "kind": "Payload",
      "metadata": {
        "type": "github",
        "name": event.payload.repository.name,
        "sha": event.payload.after,
        "head commit author": event.payload.head_commit.author.name
      },
      "spec": {
        "payload": event.payload
      }
    }})
    */

    console.log(create)
})