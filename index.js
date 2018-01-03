#!/usr/bin/env node

const program = require('commander')
const shell = require('shelljs')
const requireDir = require('require-dir')

const cmds = requireDir('./cmds')

program
  .version('0.0.1')
  .usage('[command]')

// 装配所有命令
Object.keys(cmds).map(function(c) {
  return cmds[c](program)
})

program.parse(process.argv)