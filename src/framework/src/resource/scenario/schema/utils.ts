import * as apis from '@/core/apis/apis'
import { SceneNode } from "@/components/resourceScene/scene"
import { GridSchema } from '@/core/apis/types'

// Get Schema by name
export const getSchemaInfo = async(node: SceneNode, isRemote: boolean) => {
    try {
        const res = await apis.schema.getSchema.fetch(node.name, isRemote)
        return res.grid_schema
    } catch (error) {
        console.error('Get Schema failed: ', error)
        return null
    }
}

// Delete Schema by name
export const deleteSchema = async(schemaName: string, isRemote:boolean) => {
    try {
        const res = await apis.schema.deleteSchema.fetch(schemaName, isRemote)
        return res.success
    } catch (error) {
        console.error('Delete Schema failed: ', error)
        return false
    }
}

// Update Schema Info
export const updateSchemaInfo = async(schemaName: string, schema: GridSchema, isRemote: boolean) => {
    try {
        const res = await apis.schema.updateSchema.fetch({schemaName, schema}, isRemote)
        return res.success
    } catch (error) {
        console.error('Update Schema failed: ', error)
        return false
    }
}