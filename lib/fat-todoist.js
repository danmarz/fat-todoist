import { readdir } from 'fs/promises'
import path from 'path'
import fetch from 'node-fetch'
import process from 'process'
import yargs from 'yargs'

let argv = yargs(process.argv.slice(2))
  .usage(`Usage: $0 --parent [Parent Project] --api [API key] --files`)
  .command('[opt]', 'add [F]olders [A]s [T]asks in Todoist')
  .describe('parent', 'Specify the parent project. Default is: Self-Improvement')
  .describe('api', 'Specify your Todoist API token')
  .describe('files', 'Also add [F]iles as tasks').argv

let TODOIST_API_KEY = process.env.TODOIST_API_KEY || '' // you may hardcode your token here
let PARENT_PROJECT_NAME = 'Self-Improvement 👔'        // can change the default project here
let ADD_FILES_AS_TASKS = false                         // you may want to add files as sub-tasks

if (argv.api) {
  TODOIST_API_KEY = argv.api
}
if (argv.parent) {
  PARENT_PROJECT_NAME = argv.parent
}
if (argv.files) {
  ADD_FILES_AS_TASKS = true
}

const URL_PROJECTS = 'https://api.todoist.com/rest/v1/projects'
const URL_TASKS = 'https://api.todoist.com/rest/v1/tasks'
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TODOIST_API_KEY}`,
}

async function main() {
  if (!TODOIST_API_KEY)
    throw new Error(
      'Missing API key, provide it via .env code or --api "xxxxxx" command-line argument'
    )

  let projects = await getProjects(URL_PROJECTS, HEADERS)
  let parentProject
  if (PARENT_PROJECT_NAME) {
    parentProject = await projects.filter((project) => project.name === PARENT_PROJECT_NAME)[0]

    if (!parentProject) {
      let body = {
        name: PARENT_PROJECT_NAME,
        color: 46,
      }
      parentProject = await post(URL_PROJECTS, HEADERS, body)
    }
  } else {
    let body = {
      name: path.resolve().split(path.sep).at(-1),
      color: 46,
    }
    parentProject = await post(URL_PROJECTS, HEADERS, body)
  }

  let body = {
    content: path.resolve().split(path.sep).at(-1),
    project_id: parentProject.id,
  }
  const task = await post(URL_TASKS, HEADERS, body)
  console.log(
    `Creating task ${body.content} in parent project ${parentProject.name}. See >> ${parentProject.url} << \nAdding sub-tasks..`
  )

  findAndAddTasks('.', task)
}

async function post(url, headers, body) {
  let response = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
  response = await response.json()
  return response
}

async function getProjects(url, headers) {
  let response = await fetch(url, { method: 'GET', headers: headers })
  response = await response.json()
  return response
}

async function findAndAddTasks(folderName, parent) {
  const items = await readdir(folderName, { withFileTypes: true })

  for (const item of items) {
    if (item.isDirectory()) {
      let body = {
        content: `${item.name}`,
        parent_id: parent.id,
      }
      let parentTask = await post(URL_TASKS, HEADERS, body)
      await findAndAddTasks(path.join(folderName, item.name), parentTask)
    } else {
      if (ADD_FILES_AS_TASKS) {
        let body = {
          content: `${item.name}`,
          parent_id: parent.id,
        }
        await post(URL_TASKS, HEADERS, body)
      }
    }
  }
  console.log(`Check ${parent.url} out ;)`)
}

export default main
