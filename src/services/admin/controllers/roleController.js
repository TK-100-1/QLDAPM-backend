import Role from '../models/Role.js';

export async function getRoles(req, res) {
    try {
        const roles = await Role.find({});
        res.status(200).json({ success: true, data: roles });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

export async function createRole(req, res) {
    try {
        const { name, permissions, price, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Role name is required' });
        }
        const existing = await Role.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, error: 'Role already exists' });
        }
        
        const role = await Role.create({ name, permissions, price, description });
        res.status(201).json({ success: true, data: role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

export async function updateRole(req, res) {
    try {
        const { id } = req.params;
        const { name, permissions, price, description } = req.body;
        
        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        if (name && name !== role.name) {
            const existing = await Role.findOne({ name });
            if (existing) {
                return res.status(400).json({ success: false, error: 'Role name already exists' });
            }
            role.name = name;
        }

        if (permissions) role.permissions = permissions;
        if (price !== undefined) role.price = price;
        if (description !== undefined) role.description = description;

        await role.save();
        res.status(200).json({ success: true, data: role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

export async function deleteRole(req, res) {
    try {
        const { id } = req.params;
        const role = await Role.findByIdAndDelete(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }
        res.status(200).json({ success: true, message: 'Role deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}
