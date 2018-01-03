const fs = require('fs')
const shell = require('shelljs')

module.exports = function deploy(program) {
  return program
    .command('deploy [<names...>]')
    .description('Deploy functions and config')
    .action(function (names) {
      const rootPath = shell.exec('pwd').stdout.replace('\n', '')
      
      const functions = loadFunctions(rootPath)

      console.log('f: ', functions)

      functions.map(function (f) {
        deployFunction(f, rootPath)
      })
    })
}

function loadFunctions(rootPath) {
  const arr = []
  const functionNames = fs.readdirSync(`${rootPath}/functions`)

  let projectConfig = fs.readFileSync(`${rootPath}/project.json`)
  projectConfig = JSON.parse(projectConfig.toString())

  functionNames.map(function (fname) {
    if (fs.statSync(`${rootPath}/functions/${fname}`).isDirectory()) {
      let config = fs.readFileSync(`${rootPath}/functions/${fname}/function.json`)
      config = config.toString() ? JSON.parse(config.toString()) : {}

      arr.push(Object.assign({}, projectConfig, {
        name: fname,
        project_name: projectConfig.name
      }, config))
    }
    return fname
  })

  return arr
}

function deployFunction(func, rootPath) {
  const functionName = func.name

  console.log('Deploy', functionName)

  const functionPath = `./functions/${functionName}`


  // 编译文件到 ES5
  console.log('complie files ...', `babel ${functionPath} -q -d ${functionPath}/dist`)
  shell.exec(`babel ${functionPath} -q -d ${functionPath}/dist`)
  // zip file
  shell.exec(`cp ${functionPath}/package.json ${functionPath}/dist`)
  console.log('zip files ...', `cd ${functionPath}/dist && zip -rq ../${functionName}.zip * && cd -`)
  
  shell.exec(`cd ${functionPath}/dist && zip -rq ../${functionName}.zip * && cd -`)

  // upload file to s3
  upload2S3(func)

  // create or update lambda
  createFunction(func, rootPath)

  // clean
  shell.exec(`rm -rf ${functionPath}/dist ${functionPath}/${functionName}.zip ${functionPath}/${functionName}_skeleton.json`)
}

function upload2S3(func) {
  const projectName = func.project_name
  const functionName = func.name
  const bucketName = `${projectName}-lambda-function-bucket`

  if (shell.exec(`aws s3api get-bucket-location --bucket ${bucketName}`).code !== 0) {
    // create bucket
    console.log('creating s3 bucket')
    const cmd = `aws s3api create-bucket --bucket ${bucketName} --create-bucket-configuration LocationConstraint=cn-north-1`
    console.log('create bucket: ', cmd)
    shell.exec(cmd)
  }

  console.log('upload to s3')

  shell.exec(`aws s3api put-object --bucket ${bucketName} --key ${functionName}.zip --body ./functions/${functionName}/${functionName}.zip`)
}

function createFunction(func, rootPath) {
  const projectName = func.project_name
  const functionName = func.name
  const bucketName = `${projectName}-lambda-function-bucket`

  if (shell.exec(`aws lambda get-function --function-name ${functionName}`).code === 0) {
    console.log('updating lambda function')
    shell.exec(`aws lambda update-function-code --function-name ${functionName} --s3-bucket ${bucketName} --s3-key ${functionName}.zip --publish`)
    return
  }
  
  const functionTemplate = {
    "FunctionName": func.name,
    "Runtime": func.runtime,
    "Role": func.role,
    "Handler": func.handler,
    "Code": {
      "S3Bucket": bucketName,
      "S3Key": `${functionName}.zip`,
    },
    "Description": func.description,
    "Timeout": func.timeout,
    "MemorySize": func.memory,
    "Publish": true,
    // "VpcConfig": {
    //   "SubnetIds": [
    //     ""
    //   ],
    //   "SecurityGroupIds": [
    //     ""
    //   ]
    // },
    // "DeadLetterConfig": {
    //   "TargetArn": ""
    // },
    // "Environment": {
    //   "Variables": {
    //     "KeyName": ""
    //   }
    // },
    // "KMSKeyArn": "",
    // "TracingConfig": {
    //   "Mode": "Active"
    // },
    // "Tags": {
    //   "KeyName": ""
    // }
  }

  fs.writeFileSync(`${rootPath}/functions/${functionName}/${functionName}_skeleton.json`, JSON.stringify(functionTemplate, null, 2))

  console.log('creating lambda function')
  shell.exec(`aws lambda create-function --cli-input-json file://functions/${functionName}/${functionName}_skeleton.json`)
}