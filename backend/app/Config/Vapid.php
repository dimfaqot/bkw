<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Vapid extends BaseConfig
{
    public string $publicKey  = 'BBD47VKJi9f6b3xynvZulkx6hczzV_yDhiiyO4XZtZV91Wwke3urTD0birDoGgZnarQHgCHjNJKQTtIdt7pnj9M';
    public string $privateKey = 'RPem5N211gk9mHvtr8nfiZwfBV_MErwPWYd8yQlNGsk';
    public string $subject    = 'mailto:admin@bkw-mpos.com';
}
