<?php
/* Sale property submission for the PHP deployment. */

require_once __DIR__ . '/property-type.php';

function _sale_property_pdf_build($data) {
    $commercial = is_commercial_property($data['propertyType']);
    $blue = '#004BAF'; $orange = '#F1770A'; $muted = '#687789'; $line = '#DCE5F0'; $soft = '#F4F8FF';
    $ops = _profile_pdf_rect(44, 20, 507, 2, $orange);
    $ops .= sprintf("q 112 0 0 %.2f 44 %.2f cm /Logo Do Q\n", 112 * 212 / 700, 842 - 27 - (112 * 212 / 700));
    $ops .= _profile_pdf_line(162, 27, 162, 64, $line, 0.8);
    $ops .= _profile_pdf_text(178, 27, 'PROPERTY SUBMISSION', 7, true, $orange);
    $ops .= _profile_pdf_text(551 - (strlen('Sale Property') * 10), 38, 'Sale Property', 19, true, $blue);
    $ops .= _profile_pdf_rect(445, 45, 116, 19, $soft);
    $ops .= _profile_pdf_text(551 - (strlen('REF  ' . $data['reference']) * 4.2), 51, 'REF  ' . $data['reference'], 7, true, $muted);
    $ops .= _profile_pdf_line(44, 70, 551, 70, $line, 0.8);
    $ops .= _profile_pdf_text(44, 88, mb_substr($data['name'], 0, 50), 12, true, $blue);
    $ops .= _profile_pdf_text(44, 105, mb_substr($data['email'] . '  ·  ' . $data['phone'], 0, 115), 8, false, $muted);
    $ops .= _profile_pdf_line(44, 121, 551, 121, $orange, 0.7);
    $rows = [
        ['Owner', $data['name']], ['Contact', $data['email'] . '  ·  ' . $data['phone']],
        ['Property type', $data['propertyType']], ...($commercial ? [] : [['BHK', $data['bhk']]]), ['Area', $data['area'] . ' sq ft'], ['Floor', $data['floor']],
        [property_number_label($data['propertyType']), $data['houseNumber']], ['Street / locality', $data['address']],
        ['City / state', $data['city'] . ', ' . $data['state']], ['Sale amount', 'INR ' . $data['saleAmount']],
        ['Existing bank loan', $data['bankLoan']], ['Bank name', $data['bankLoan'] === 'Yes' ? $data['bankName'] : 'Not applicable'], ['Remarks', $data['remarks'] ?: 'Not provided']
    ];
    $top = 132; $labelW = 148;
    foreach ($rows as [$label, $value]) {
        $value = (string)($value !== '' ? $value : 'Not provided');
        $lines = explode("\n", wordwrap($value, 92, "\n", true));
        $height = max(17, count($lines) * 8 + 6);
        $ops .= _profile_pdf_rect(44, $top, 507, $height, '#FFFFFF', $line);
        $ops .= _profile_pdf_rect(44, $top, $labelW, $height, $soft);
        $ops .= _profile_pdf_text(51, $top + 5, strtoupper($label), 7, true, $muted);
        foreach ($lines as $index => $valueLine) $ops .= _profile_pdf_text(201, $top + 4 + ($index * 8), $valueLine, 8, false, '#182433');
        $top += $height;
    }
    $ops .= _profile_pdf_text(44, 814, 'Property owner submission  ·  earthsar Real Estate Advisory', 7, false, $muted);
    $objects = [
        1 => '<< /Type /Catalog /Pages 2 0 R >>',
        2 => '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        3 => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Logo 7 0 R >> >> /Contents 4 0 R >>',
        4 => '<< /Length ' . strlen($ops) . " >>\nstream\n" . $ops . 'endstream',
        5 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        6 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ];
    $logoJpeg = file_get_contents(__DIR__ . '/../public/assets/earthsar-logo-pdf.jpg');
    $objects[7] = '<< /Type /XObject /Subtype /Image /Width 700 /Height 212 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($logoJpeg) . " >>\nstream\n" . $logoJpeg . "\nendstream";
    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; $offsets = [0];
    foreach ($objects as $number => $object) { $offsets[$number] = strlen($pdf); $pdf .= $number . " 0 obj\n" . $object . "\nendobj\n"; }
    $xref = strlen($pdf); $pdf .= "xref\n0 8\n0000000000 65535 f \n";
    for ($n = 1; $n <= 7; $n++) $pdf .= sprintf("%010d 00000 n \n", $offsets[$n]);
    $pdf .= "trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n" . $xref . "\n%%EOF";
    return $pdf;
}

function post_sale_property() {
    global $_EMAIL_RE, $config;
    ensure_not_maintenance();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $form_settings = read_public_settings()['forms']['saleProperty'];
    $enabled = fn($key) => ($form_settings['fields'][$key] ?? true) !== false;
    $choices = fn($key) => array_values(array_map(fn($item) => $item['value'], array_filter($form_settings['options'][$key] ?? [], fn($item) => ($item['visible'] ?? true) !== false)));
    if (!empty($body['website'])) _pub_json_out(['ok' => true], 201);
    $data = [
        'reference' => 'SP-' . strtoupper(bin2hex(random_bytes(3))),
        'name' => _pub_str($body['name'] ?? '', 100),
        'email' => strtolower(_pub_str($body['email'] ?? '', 200)),
        'phone' => _pub_str($body['phone'] ?? '', 30),
        'propertyType' => _pub_str($body['propertyType'] ?? '', 30),
        'bhk' => _pub_str($body['bhk'] ?? '', 20),
        'floor' => _pub_str($body['floor'] ?? '', 30),
        'houseNumber' => _pub_str($body['houseNumber'] ?? '', 60),
        'address' => _pub_str($body['address'] ?? '', 300),
        'city' => _pub_str($body['city'] ?? '', 80),
        'state' => _pub_str($body['state'] ?? '', 80),
        'area' => _pub_str($body['area'] ?? '', 8),
        'saleAmount' => _pub_str($body['saleAmount'] ?? '', 12),
        'bankLoan' => _pub_str($body['bankLoan'] ?? '', 3),
        'bankName' => _pub_str($body['bankName'] ?? '', 120),
        'remarks' => _pub_str($body['remarks'] ?? '', 600)
    ];
    $errors = [];
    if (mb_strlen($data['name']) < 2) $errors['name'] = 'Enter your full name.';
    if (!preg_match($_EMAIL_RE, $data['email'])) $errors['email'] = 'Enter a valid email address.';
    if (strlen(preg_replace('/\D/', '', $data['phone'])) < 7) $errors['phone'] = 'Enter a valid phone number.';
    if ($enabled('propertyType') && !in_array($data['propertyType'], $choices('propertyType'), true)) $errors['propertyType'] = 'Choose a property type.';
    $commercial = is_commercial_property($data['propertyType']);
    if (!$commercial && $enabled('bhk') && !in_array($data['bhk'], $choices('bhk'), true)) $errors['bhk'] = 'Choose the BHK configuration.';
    if ($enabled('floor') && !$data['floor']) $errors['floor'] = 'Enter the property floor.';
    if ($enabled('houseNumber') && !$data['houseNumber']) $errors['houseNumber'] = $commercial ? 'Enter the ' . strtolower(property_number_label($data['propertyType'])) : 'Enter the house or flat number.';
    if ($enabled('address') && mb_strlen($data['address']) < 5) $errors['address'] = 'Enter the street or locality.';
    if ($enabled('city') && !$data['city']) $errors['city'] = 'Enter the city.';
    if ($enabled('state') && !$data['state']) $errors['state'] = 'Enter the state.';
    if ($enabled('area') && (!preg_match('/^\d{2,7}$/', $data['area']) || (int)$data['area'] < 100)) $errors['area'] = 'Enter the area in square feet.';
    if ($enabled('saleAmount') && (!preg_match('/^\d{1,10}$/', $data['saleAmount']) || (int)$data['saleAmount'] < 1)) $errors['saleAmount'] = 'Enter the sale amount in rupees.';
    if (!in_array($data['bankLoan'], ['Yes','No'], true)) $errors['bankLoan'] = 'Please choose Yes or No for an existing bank loan.';
    if ($data['bankLoan'] === 'Yes' && $enabled('bankName') && !$data['bankName']) $errors['bankName'] = 'Enter the bank name.';
    if (($body['consent'] ?? false) !== true) $errors['consent'] = 'Please confirm that we may contact you about the property.';
    if ($errors) _pub_json_out(['error' => 'Check the highlighted fields.', 'fields' => $errors], 400);
    if (!function_exists('mail')) _pub_json_out(['error' => 'Email delivery is not available. Please contact earthsar directly.'], 503);

    $pdf = _sale_property_pdf_build($data);
    $boundary = 'earthsar_' . bin2hex(random_bytes(12));
    $filename = 'earthsar-sale-property-' . $data['reference'] . '.pdf';
    $from = filter_var($config['MAIL_FROM'] ?? 'info@earthsar.in', FILTER_VALIDATE_EMAIL) ?: 'info@earthsar.in';
    $subject = '=?UTF-8?B?' . base64_encode('Sale property submission - ' . $data['name'] . ' - ' . $data['reference']) . '?=';
    $headers = [
        'From: earthsar <' . $from . '>', 'Reply-To: ' . $data['email'], 'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"'
    ];
    $propertyDescription = $data['propertyType'] . ($commercial ? '' : ', ' . $data['bhk']);
    $message = "A property was submitted for sale through earthsar.in.\r\n\r\nOwner: {$data['name']}\r\nPhone: {$data['phone']}\r\nEmail: {$data['email']}\r\nProperty: {$propertyDescription}\r\nAddress: {$data['houseNumber']}, {$data['address']}\r\nFloor: {$data['floor']}\r\nArea: {$data['area']} sq ft\r\nCity: {$data['city']}\r\nSale amount: INR {$data['saleAmount']}\r\nBank loan: {$data['bankLoan']}\r\nReference: {$data['reference']}\r\n\r\nThe completed sale property details are attached as a PDF.";
    $mailBody = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n{$message}";
    $mailBody .= "\r\n--{$boundary}\r\nContent-Type: application/pdf; name=\"{$filename}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n" . chunk_split(base64_encode($pdf)) . "\r\n--{$boundary}--\r\n";
    if (!@mail('info@earthsar.in', $subject, $mailBody, implode("\r\n", $headers))) {
        _pub_json_out(['error' => 'The property details could not be emailed right now. Please try again or contact earthsar directly.'], 503);
    }
    _pub_json_out(['ok' => true, 'reference' => $data['reference']], 201);
}
