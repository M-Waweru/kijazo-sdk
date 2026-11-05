import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeProject } from '../src/access-policy.mjs'

test('a GitHub user with write access can edit only after app installation',()=>{
 const without=authorizeProject({authenticated:true,appInstalled:false,repositoryAccessible:true,githubPermission:'write'})
 assert.equal(without.canEdit,false)
 const withApp=authorizeProject({authenticated:true,appInstalled:true,repositoryAccessible:true,githubPermission:'write'})
 assert.equal(withApp.canEdit,true)
 assert.equal(withApp.canPublish,false)
})
test('repository contributor cannot silently deploy production',()=>{
 const permission=authorizeProject({authenticated:true,appInstalled:true,repositoryAccessible:true,githubPermission:'write',allowedActions:['publish']})
 assert.equal(permission.canEdit,true)
 assert.equal(permission.canPublish,false)
})
test('owner publishing needs an explicit project permission',()=>{
 const data={authenticated:true,appInstalled:true,repositoryAccessible:true,githubPermission:'admin',projectRole:'owner'}
 assert.equal(authorizeProject(data).canPublish,false)
 assert.equal(authorizeProject({...data,allowedActions:['publish']}).canPublish,true)
})
test('viewer and unknown GitHub roles remain read-only or denied',()=>{
 const reader=authorizeProject({authenticated:true,appInstalled:true,repositoryAccessible:true,githubPermission:'read'})
 assert.equal(reader.canView,true)
 assert.equal(reader.canEdit,false)
 assert.equal(authorizeProject({authenticated:true,appInstalled:true,repositoryAccessible:true,githubPermission:'contributor'}).canEdit,false)
})
