<?php
// Script untuk merapikan semua data lama di database
$db = \Config\Database::connect();

// 1. users: nama ucwords, email strtolower
$users = $db->table('users')->get()->getResult();
foreach ($users as $u) {
    $email = $u->email ? strtolower($u->email) : null;
    $db->table('users')->where('id', $u->id)->update([
        'nama' => ucwords(strtolower($u->nama)),
        'email' => $email
    ]);
}

// 2. menus: label ucwords, grup ucwords, role_akses ucwords per comma, icon StrReplace, url strtolower, tabel strtolower
$menus = $db->table('menus')->get()->getResult();
foreach ($menus as $m) {
    $roles = array_map('trim', explode(',', $m->role_akses));
    $roles = array_map(function($r) { return ucwords(strtolower($r)); }, $roles);
    $role_akses = implode(',', array_filter($roles));

    $db->table('menus')->where('id', $m->id)->update([
        'label' => ucwords(strtolower($m->label)),
        'grup' => ucwords(strtolower($m->grup)),
        'role_akses' => $role_akses,
        'icon' => str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $m->icon))),
        'url' => strtolower($m->url),
        'tabel' => strtolower($m->tabel)
    ]);
}

// 3. roles: nama_role ucwords, deskripsi ucsentence
$roles = $db->table('roles')->get()->getResult();
foreach ($roles as $r) {
    $deskripsi = ucfirst(strtolower($r->deskripsi));
    $deskripsi = preg_replace_callback('/([.?!])\s*([a-z])/', function ($matches) {
        return $matches[1] . ' ' . strtoupper($matches[2]);
    }, $deskripsi);
    
    $db->table('roles')->where('id', $r->id)->update([
        'nama_role' => ucwords(strtolower($r->nama_role)),
        'deskripsi' => $deskripsi
    ]);
}

// 4. unit: nama_unit ucwords
$units = $db->table('unit')->get()->getResult();
foreach ($units as $u) {
    $db->table('unit')->where('id', $u->id)->update([
        'nama_unit' => ucwords(strtolower($u->nama_unit))
    ]);
}

// 5. usaha: nama_usaha ucwords, alamat ucwords, no_izin strtoupper
$usahas = $db->table('usaha')->get()->getResult();
foreach ($usahas as $u) {
    $alamat = $u->alamat ? ucwords(strtolower($u->alamat)) : null;
    $no_izin = $u->no_izin ? strtoupper($u->no_izin) : null;
    $db->table('usaha')->where('id', $u->id)->update([
        'nama_usaha' => ucwords(strtolower($u->nama_usaha)),
        'alamat' => $alamat,
        'no_izin' => $no_izin
    ]);
}

echo "Semua data berhasil dirapikan!\n";
