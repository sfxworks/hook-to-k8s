repo = local_git_repo('.')


k8s_yaml(helm('hook-to-k8s'))
docker_build('gcr.io/allthingssfx/hook-to-k8s', 'operator',
  live_update=[
    # when package.json changes, we need to do a full build
    fall_back_on(['operator/package.json', 'operator/package-lock.json']),
    # Map the local source code into the container under /src
    sync('operator/src', '/usr/src/app/src'),
  ])

k8s_resource('node-webhook', port_forwards='8080')
