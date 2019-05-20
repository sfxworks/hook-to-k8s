


 var builder = yaml.safeLoad(fs.readFileSync('/usr/src/app/src/kaniko-builder.yml', 'utf8'));
 builder.spec.template.arguments[0].value += ':' + event.payload.head_commit.id
 builder.metadata.name = 'hook-build-' + event.payload.head_commit.id

 console.log('builder: ', util.inspect(builder, {showHidden: false, depth: null}))

 const createBuilder = await client.apis["build.knative.dev"].v1alpha1.namespaces('default').builds.post({body: builder})

 //console.log(createHook)
 console.log(createBuilder)


 const stream = client.apis['build.knative.dev'].v1alpha1.watch.builds.getStream()
 const jsonStream = new JSONStream()
 console.log("Pipe stream.")
 stream.pipe(jsonStream)
 
 jsonStream.on('data', async (buildEvent) => {
   if(buildEvent)
   {
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

             const patchService = await client.apis["serving.knative.dev"].v1alpha1.namespaces('default').services('mcserverhosting-net-site').put({
               body: {
                 apiVersion: "serving.knative.dev/v1alpha1",
                 kind: "Service",
                 metadata: {
                   name: "mcserverhosting-net-site",
                   resourceVersion: "27547688"
                 },
                 spec: {
                   runLatest: {
                     configuration: {
                       revisionTemplate: {
                         spec: {
                           container: {
                             image: "docker.io/quantomworks/mcsh-site:" + build.metadata.annotations['hook-to-k8s'],
                             name: ""
                           }
                         }
                       }
                     }
                   }
                 }
               }
             })

             console.log("Patch result:")
             console.log(patchService)



           }
         }

       }
     }
   }
 })