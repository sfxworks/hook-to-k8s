var http = require('http')
var createHandler = require('github-webhook-handler')
var yaml = require('js-yaml');
var fs   = require('fs');
const JSONStream = require('json-stream')

//var handler = createHandler({ path: '/' + process.env.WEBHOOK_PATH, secret: process.env.WEBHOOK_SECRET })
var handler = createHandler({ path: '/webhook', secret: 'supersecret' })

const util = require('util')


const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config
const client = new Client({ config: config.getInCluster() })

const payloadCRD = require('./crd/payloads.json')
const buildCRD = require('./crd/builds.json')
const serviceCRD = require('./crd/service.json')

async function main () {
  try {
    await client.loadSpec()

    //const create = await client.apis['apiextensions.k8s.io'].v1beta1.customresourcedefinitions.post({ body: crd })
    //console.log('Create: ', create)

    client.addCustomResourceDefinition(payloadCRD)
    client.addCustomResourceDefinition(buildCRD)
    client.addCustomResourceDefinition(serviceCRD)

    const all = await client.apis['hook-to-k8s.sfxworks.net'].v1.namespaces('default').payloads.get()
    console.log('All: ', util.inspect(all, {showHidden: false, depth: null}))


    setupHandler()
    
  } catch (error) {
    console.error('Error: ', error)
  }
}


main()

function setupHandler() {

  http.createServer((req, res) => {
    handler(req, res, (err) => {
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
      const createHook = await client.apis["hook-to-k8s.sfxworks.net"].v1.namespaces('default').payloads.post({ body: {
        "apiVersion": "hook-to-k8s.sfxworks.net/v1",
        "kind": "Payload",
        "metadata": {
          "type": "github",
          "name": event.payload.head_commit.id,
          "sha": event.payload.after,
          "head commit author": event.payload.head_commit.author.name
        },
        "spec": event.payload
      }})*/
      var builder = yaml.safeLoad(fs.readFileSync('/usr/src/app/src/kaniko-builder.yml', 'utf8'));
      builder.spec.template.arguments[0].value += ':' + event.payload.head_commit.id
      builder.metadata.name = 'hook-build-' + event.payload.head_commit.id

      console.log('builder: ', util.inspect(builder, {showHidden: false, depth: null}))

      const createBuilder = await client.apis["build.knative.dev"].v1alpha1.namespaces('default').builds.post({body: builder})
  
      //console.log(createHook)
      console.log(createBuilder)


      const stream = client.apis['build.knative.dev'].v1alpha1.watch.builds.getStream()
      const jsonStream = new JSONStream()
      stream.pipe(jsonStream)
      jsonStream.on('data', async (buildEvent) => {
        build = buildEvent.object
        if('annotations' in build.metadata)
        {
          if('hook-to-k8s' in build.metadata.annotations)
          {
            console.log(`Update: Status of: ${build.metadata.annotations['hook-to-k8s']} has been update with the following properties:`)
            console.log(DumpObjectIndented(build.status.conditions, '   '))

            if(build.status.conditions[0].status == 'True')
            {
              if(build.status.conditions[0].type == "Succeeded")
              {
                console.log("Service ready to be updated.")
                console.log(build.metadata.annotations['hook-to-k8s'])
                stream.abort()

                const patchService = await client.apis["serving.knative.dev"].v1alpha1.namespaces('default').services('mcserverhosting-net-site').patch({body: {
                  "spec": {
                    "template": {
                      "spec": {
                        "containers": [
                          {
                            "image": "docker.io/quantomworks/mcsh-site:" + build.metadata.annotations['hook-to-k8s']
                          }
                        ]
                      }
                    }
                  }
                }})

                console.log("Patch result:")
                console.log(patchService)



              }
            }

          }
        }
          
      })
  })
}


/*
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
    

    console.log(create)
})

*/


function DumpObjectIndented(obj, indent)
{
  var result = "";
  if (indent == null) indent = "";

  for (var property in obj)
  {
    var value = obj[property];
    if (typeof value == 'string')
      value = "'" + value + "'";
    else if (typeof value == 'object')
    {
      if (value instanceof Array)
      {
        // Just let JS convert the Array to a string!
        value = "[ " + value + " ]";
      }
      else
      {
        // Recursive dump
        // (replace "  " by "\t" or something else if you prefer)
        var od = DumpObjectIndented(value, indent + "  ");
        // If you like { on the same line as the key
        //value = "{\n" + od + "\n" + indent + "}";
        // If you prefer { and } to be aligned
        value = "\n" + indent + "{\n" + od + "\n" + indent + "}";
      }
    }
    result += indent + "'" + property + "' : " + value + ",\n";
  }
  return result.replace(/,\n$/, "");
}
