<?php

namespace App\Modules\Auth\Models;

use CodeIgniter\Model;

class UserRoleModel extends Model
{
    protected $table            = 'user_role';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $allowedFields    = ['user_id', 'usaha_id', 'unit_id', 'role_id', 'created_at', 'updated_at'];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    // Helper method to get user roles with associated business and role name
    public function dapatkanPeranUser($userId)
    {
        return $this->select('user_role.*, usaha.nama_usaha, roles.nama_role, unit.nama_unit')
                    ->join('usaha', 'usaha.id = user_role.usaha_id', 'left')
                    ->join('roles', 'roles.id = user_role.role_id')
                    ->join('unit', 'unit.id = user_role.unit_id', 'left')
                    ->where('user_role.user_id', $userId)
                    ->findAll();
    }
}
