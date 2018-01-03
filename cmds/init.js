const fs = require('fs')
const prompt = require('prompt')
const shell = require('shelljs')

/**
 * 初始化 project.json 文件
 * @param {*} program 
 */
module.exports = function init(program) {
  return program
    .command('init')
    .description('Initialize a project')
    .action(function () {
      if (shell.find('project.json').code === 0) {
        console.log('\nI\'ve detected a ./project.json file, this seems to already be a project!\n')
        process.exit(0)
      }

      prompt.start()

      console.log('\nEnter the name of your project. It should be machine-friendly, as this is used to prefix your functions in Lambda.\n')

      prompt.get([{
        name: 'name',
        description: 'Project name',
        type: 'string',
        required: true,
      }, {
        name: 'description',
        description: 'Project description',
        required: false
      }], function (err, result) {
        // 为整个项目创建一个角色(role)
        const roleArn = createRole(`${result.name}_lambda_function`)
        const policyArn = createPolicy(`${result.name}_lambda_logs`)
        attachRolePolicy(`${result.name}_lambda_function`, policyArn)

        // 写入文件
        const config = {
          name: result.name,
          description: result.description,
          memory: 128,
          timeout: 5,
          role: roleArn,
          environment: {}
        }

        createProjectConfig(config)
        createFunctions()
      })
    })
}

function createRole(name) {
  const cmd = `aws iam create-role --role-name ${name} --assume-role-policy-document file://${__dirname}/../files/iamAssumeRolePolicy.json`
  console.log(`creating IAM ${name} role`)
  const result = shell.exec(cmd)
  if (result.code !== 0) {
    shell.echo('Error: Create role failed');
    shell.exit(1);
    process.exit(1)
  }
  const json = JSON.parse(result)
  return json.Role.Arn
}

function createPolicy(name) {
  const cmd = `aws iam create-policy --policy-name ${name} --policy-document file://${__dirname}/../files/iamLogsPolicy.json`
  console.log(`creating IAM ${name} policy`)
  const result = shell.exec(cmd)

  if (result.code !== 0) {
    shell.echo('Error: Create policy failed');
    shell.exit(1);
    process.exit(1)
  }

  const json = JSON.parse(result)
  return json.Policy.Arn
}

function attachRolePolicy(roleName, policyArn) {
  const cmd = `aws iam attach-role-policy --role-name ${roleName} --policy-arn ${policyArn}`
  console.log(`attaching policy to ${roleName} role`)
  if (shell.exec(cmd).code !== 0) {
    shell.echo('Error: Attach policy to role failed');
    shell.exit(1);
    process.exit(1)
  }
}

function createProjectConfig(config) {
  console.log('creating ./project.json')
  fs.writeFileSync('./project.json', JSON.stringify(config, null, 2))
}

function createFunctions() {
  console.log('creating ./functions')
  const cmd = `mkdir -p functions/hello && cp ${__dirname}/../files/functionTemplate.js functions/hello/index.js`

  if (shell.exec(cmd).code !== 0) {
    shell.echo('Error: Create functions failed');
    shell.exit(1);
    process.exit(1)
  }
}