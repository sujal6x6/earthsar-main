<?php
// site-settings.php

$DEFAULT_SITE_SETTINGS = [
    'hero' => [
        'badge' => 'Since 2010',
        'heading' => 'Professional Land Surveyors',
        'subheading' => 'Expert boundary, topographic, and construction surveying services.',
        'primary_cta' => 'Request a Quote',
        'secondary_cta' => 'Our Services'
    ],
    'contact' => [
        'phone' => '+1 (555) 123-4567',
        'email' => 'info@earthsar.com',
        'address' => '123 Survey Way, Topo City, ST 12345',
        'facebook' => '',
        'twitter' => '',
        'instagram' => '',
        'linkedin' => ''
    ],
    'stats' => [
        ['label' => 'Years Experience', 'value' => '14+'],
        ['label' => 'Projects Completed', 'value' => '1000+'],
        ['label' => 'Expert Surveyors', 'value' => '10+'],
        ['label' => 'Satisfied Clients', 'value' => '500+']
    ],
    'seo' => [
        'title' => 'EarthSAR | Professional Land Surveying',
        'description' => 'Professional land surveying services including boundary, topographic, and construction surveys.',
        'keywords' => 'land surveyor, boundary survey, topographic survey, construction staking'
    ],
    'team' => [
        [
            'id' => 't1',
            'name' => 'John Doe',
            'role' => 'Lead Surveyor',
            'bio' => 'Over 20 years of experience in complex boundary surveys.',
            'image' => null
        ],
        [
            'id' => 't2',
            'name' => 'Jane Smith',
            'role' => 'Project Manager',
            'bio' => 'Ensures all projects are delivered on time and with precision.',
            'image' => null
        ],
        [
            'id' => 't3',
            'name' => 'Mike Johnson',
            'role' => 'Field Technician',
            'bio' => 'Expert in modern topographic mapping and drone surveys.',
            'image' => null
        ]
    ]
];

function text($v, $max) {
    if (!is_string($v)) return '';
    $v = trim($v);
    if (strlen($v) > $max) {
        return substr($v, 0, $max);
    }
    return $v;
}

function clean_hero($hero) {
    global $DEFAULT_SITE_SETTINGS;
    if (!is_array($hero)) return $DEFAULT_SITE_SETTINGS['hero'];
    
    return [
        'badge' => text($hero['badge'] ?? $DEFAULT_SITE_SETTINGS['hero']['badge'], 50),
        'heading' => text($hero['heading'] ?? $DEFAULT_SITE_SETTINGS['hero']['heading'], 100),
        'subheading' => text($hero['subheading'] ?? $DEFAULT_SITE_SETTINGS['hero']['subheading'], 200),
        'primary_cta' => text($hero['primary_cta'] ?? $DEFAULT_SITE_SETTINGS['hero']['primary_cta'], 50),
        'secondary_cta' => text($hero['secondary_cta'] ?? $DEFAULT_SITE_SETTINGS['hero']['secondary_cta'], 50)
    ];
}

function clean_contact($contact) {
    global $DEFAULT_SITE_SETTINGS;
    if (!is_array($contact)) return $DEFAULT_SITE_SETTINGS['contact'];
    
    return [
        'phone' => text($contact['phone'] ?? $DEFAULT_SITE_SETTINGS['contact']['phone'], 50),
        'email' => filter_var($contact['email'] ?? $DEFAULT_SITE_SETTINGS['contact']['email'], FILTER_SANITIZE_EMAIL),
        'address' => text($contact['address'] ?? $DEFAULT_SITE_SETTINGS['contact']['address'], 200),
        'facebook' => filter_var($contact['facebook'] ?? $DEFAULT_SITE_SETTINGS['contact']['facebook'], FILTER_SANITIZE_URL),
        'twitter' => filter_var($contact['twitter'] ?? $DEFAULT_SITE_SETTINGS['contact']['twitter'], FILTER_SANITIZE_URL),
        'instagram' => filter_var($contact['instagram'] ?? $DEFAULT_SITE_SETTINGS['contact']['instagram'], FILTER_SANITIZE_URL),
        'linkedin' => filter_var($contact['linkedin'] ?? $DEFAULT_SITE_SETTINGS['contact']['linkedin'], FILTER_SANITIZE_URL)
    ];
}

function clean_stats($stats) {
    global $DEFAULT_SITE_SETTINGS;
    if (!is_array($stats)) return $DEFAULT_SITE_SETTINGS['stats'];
    
    $clean = [];
    foreach ($stats as $stat) {
        if (is_array($stat) && isset($stat['label']) && isset($stat['value'])) {
            $clean[] = [
                'label' => text($stat['label'], 50),
                'value' => text($stat['value'], 20)
            ];
        }
    }
    return empty($clean) ? $DEFAULT_SITE_SETTINGS['stats'] : array_slice($clean, 0, 10);
}

function clean_seo($seo) {
    global $DEFAULT_SITE_SETTINGS;
    if (!is_array($seo)) return $DEFAULT_SITE_SETTINGS['seo'];
    
    return [
        'title' => text($seo['title'] ?? $DEFAULT_SITE_SETTINGS['seo']['title'], 100),
        'description' => text($seo['description'] ?? $DEFAULT_SITE_SETTINGS['seo']['description'], 300),
        'keywords' => text($seo['keywords'] ?? $DEFAULT_SITE_SETTINGS['seo']['keywords'], 200)
    ];
}

function clean_team($team) {
    global $DEFAULT_SITE_SETTINGS;
    if (!is_array($team)) return $DEFAULT_SITE_SETTINGS['team'];
    
    $clean = [];
    foreach ($team as $member) {
        if (is_array($member) && isset($member['name'])) {
            $clean[] = [
                'id' => text($member['id'] ?? uniqid('t'), 20),
                'name' => text($member['name'], 100),
                'role' => text($member['role'] ?? '', 100),
                'bio' => text($member['bio'] ?? '', 300),
                'image' => (isset($member['image']) && is_array($member['image'])) ? $member['image'] : null
            ];
        }
    }
    return empty($clean) ? $DEFAULT_SITE_SETTINGS['team'] : array_slice($clean, 0, 20);
}

function sanitize_site_settings($input) {
    global $DEFAULT_SITE_SETTINGS;
    if (!is_array($input)) return $DEFAULT_SITE_SETTINGS;
    
    return [
        'hero' => clean_hero($input['hero'] ?? null),
        'contact' => clean_contact($input['contact'] ?? null),
        'stats' => clean_stats($input['stats'] ?? null),
        'seo' => clean_seo($input['seo'] ?? null),
        'team' => clean_team($input['team'] ?? null)
    ];
}
