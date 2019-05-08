var http = require('http')
var createHandler = require('github-webhook-handler')
var handler = createHandler({ path: '/' + process.env.WEBHOOK_PATH, secret: process.env.WEBHOOK_SECRET })

const k8s = require('@kubernetes/client-node')
const kc = new k8s.KubeConfig()
kc.loadFromCluster()
const k8sApi = kc.makeApiClient(k8s.Custom_objectsApi)


http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404
    res.end('no such location')
  })
}).listen(8080)
 
handler.on('error', function (err) {
  console.error('Error:', err.message)
})
 
handler.on('push', function (event) {
  console.log('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref)
  const yamlString = k8s.dumpYaml({
    "apiVersion": "stable.example.com/v1",
    "kind": "Payload",
    "metadata": {
      "type": "github",
      "name": event.payload.repository.name,
      "sha": event.payload.sha,
      "size": event.payload.size
    },
    "spec": {
      "payload": event.payload
    }
  })


  k8sApi.createNamespacedCustomObject(yamlString).then((response) => {
    console.log("Logged payload into CRD")
    console.log(response)
  }, (err) =>{
    console.log("Error while handling payload write: " + err)
  })
})

console.log("Initialized.")