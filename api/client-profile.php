<?php
/* Client profile intake for the PHP deployment. Profile data is emailed only. */

function _profile_pdf_text($x, $top, $text, $size, $bold, $hex) {
    $text = trim((string)$text);
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
        if ($converted !== false) $text = $converted;
    }
    $text = preg_replace('/[^\x20-\x7E\x80-\xFF]/', '?', $text);
    $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    $r = hexdec(substr($hex, 1, 2)) / 255;
    $g = hexdec(substr($hex, 3, 2)) / 255;
    $b = hexdec(substr($hex, 5, 2)) / 255;
    $y = 842 - $top - $size;
    $font = $bold ? 'F2' : 'F1';
    return sprintf("%.3f %.3f %.3f rg BT /%s %d Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET\n", $r, $g, $b, $font, $size, $x, $y, $text);
}

function _profile_pdf_rect($x, $top, $width, $height, $hex, $stroke = null) {
    $r = hexdec(substr($hex, 1, 2)) / 255;
    $g = hexdec(substr($hex, 3, 2)) / 255;
    $b = hexdec(substr($hex, 5, 2)) / 255;
    $y = 842 - $top - $height;
    $op = sprintf("%.3f %.3f %.3f rg %.2f %.2f %.2f %.2f re f\n", $r, $g, $b, $x, $y, $width, $height);
    if ($stroke) {
        $sr = hexdec(substr($stroke, 1, 2)) / 255;
        $sg = hexdec(substr($stroke, 3, 2)) / 255;
        $sb = hexdec(substr($stroke, 5, 2)) / 255;
        $op .= sprintf("%.3f %.3f %.3f RG 0.6 w %.2f %.2f %.2f %.2f re S\n", $sr, $sg, $sb, $x, $y, $width, $height);
    }
    return $op;
}

function _profile_pdf_line($x1, $top1, $x2, $top2, $hex, $width = 0.8) {
    $r = hexdec(substr($hex, 1, 2)) / 255;
    $g = hexdec(substr($hex, 3, 2)) / 255;
    $b = hexdec(substr($hex, 5, 2)) / 255;
    return sprintf("%.3f %.3f %.3f RG %.2f w %.2f %.2f m %.2f %.2f l S\n", $r, $g, $b, $width, $x1, 842 - $top1, $x2, 842 - $top2);
}

function _profile_pdf_build($data, $photoJpeg = null, $photoSize = null) {
    $blue = '#004BAF'; $orange = '#F1770A'; $muted = '#687789'; $line = '#DCE5F0'; $soft = '#F4F8FF';
    $ops = _profile_pdf_rect(44, 20, 507, 2, $orange);
    $ops .= sprintf("q 112 0 0 %.2f 44 %.2f cm /Logo Do Q\n", 112 * 212 / 700, 842 - 27 - (112 * 212 / 700));
    $ops .= _profile_pdf_line(162, 27, 162, 64, $line, 0.8);
    $ops .= _profile_pdf_text(178, 27, 'CLIENT BRIEF', 7, true, $orange);
    $ops .= _profile_pdf_text(551 - (strlen('Client Profile') * 10), 25, 'Client Profile', 19, true, $blue);
    $ops .= _profile_pdf_rect(435, 48, 116, 16, $soft);
    $ops .= _profile_pdf_text(545 - (strlen('REF  ' . $data['reference']) * 4.2), 52, 'REF  ' . $data['reference'], 7, true, $muted);
    $ops .= _profile_pdf_line(44, 70, 551, 70, $line, 0.8);
    if ($photoJpeg && $photoSize) {
        [$pw, $ph] = $photoSize; $scale = min(48 / max(1, $pw), 52 / max(1, $ph));
        $drawW = $pw * $scale; $drawH = $ph * $scale;
        $ops .= sprintf("q %.2f 0 0 %.2f %.2f %.2f cm /Im1 Do Q\n", $drawW, $drawH, 44 + (48 - $drawW) / 2, 842 - 83 - $drawH);
        $nameX = 102;
    } else $nameX = 44;
    $ops .= _profile_pdf_text($nameX, 88, mb_substr($data['name'], 0, 48), 13, true, $blue);
    $sub = trim($data['company'] . '  ·  ' . $data['designation'], ' ·');
    if ($sub !== '') $ops .= _profile_pdf_text($nameX, 106, mb_substr($sub, 0, 88), 7, false, $muted);
    $ops .= _profile_pdf_line($nameX, 121, 551, 121, $orange, 0.7);
    $spouseProfession = '';
    if ($data['wifeWorks'] === 'Yes') {
        $spouseProfession = implode(' / ', array_filter(
            [$data['wifeDesignation'], $data['wifeCompany']],
            fn($value) => $value !== ''
        ));
    } elseif ($data['wifeWorks'] === 'No') {
        $spouseProfession = 'Not working';
    }
    $primaryRows = [
        ['Name', $data['name']], ['Phone no.', $data['phone']], ['Email', $data['email']],
        ['Company / profession', $data['company']], ['Spouse profession', $spouseProfession],
        ['No. of family members', $data['familyCount']], ['Shifting from', $data['shiftingFrom']]
    ];
    $otherRows = [
        ['Offer date', $data['offerDate']], ['LinkedIn profile available', $data['hasLinkedIn']]
    ];
    if ($data['hasLinkedIn'] === 'Yes' && $data['linkedinProfile'] !== '') $otherRows[] = ['LinkedIn profile', $data['linkedinProfile']];
    $otherRows = array_merge($otherRows, [
        ['Family members residing', $data['familyDetails']], ['Native place', $data['nativePlace']],
        ['Expected shifting date', $data['shiftDate']], ['Educational background', $data['education']],
        ['Designation', $data['designation']], ['Preferred flat size', $data['preferredFlat']],
        ['Monthly rental budget', 'INR ' . $data['budget']], ['Has pets', $data['hasPets']]
    ]);
    if ($data['hasPets'] === 'Yes' && $data['pets'] !== '') $otherRows[] = ['Pet details / housing needs', $data['pets']];

    $gap = 16;
    $columnW = (507 - $gap) / 2;
    $ops .= _profile_pdf_text(44, 143, 'CLIENT DETAILS', 9, true, $orange);
    $ops .= _profile_pdf_line(44, 156, 551, 156, $orange, 0.7);
    foreach ([[44, $primaryRows], [44 + $columnW + $gap, $otherRows]] as [$x, $rows]) {
        $top = 160;
        foreach ($rows as [$label, $value]) {
            $value = trim((string)$value);
            $value = preg_replace('/\s+/u', ' ', $value) ?: ($value === '0' ? '0' : 'Not provided');
            // Keep even wide Helvetica glyphs within the column and preserve UTF-8 characters.
            preg_match_all('/.{1,29}(?: |$)|.{1,29}/u', $value, $matches);
            $lines = $matches[0];
            $height = max(27, 17 + count($lines) * 8);
            $ops .= _profile_pdf_rect($x, $top, $columnW, $height, $soft, $line);
            $ops .= _profile_pdf_text($x + 7, $top + 4, strtoupper($label), 7, true, $muted);
            foreach ($lines as $index => $valueLine) {
                $ops .= _profile_pdf_text($x + 7, $top + 15 + $index * 8, $valueLine, 8, false, '#182433');
            }
            $top += $height;
        }
    }
    $ops .= _profile_pdf_text(44, 814, 'Private client information  ·  earthsar Real Estate Advisory', 7, false, $muted);
    $objects = [
        1 => '<< /Type /Catalog /Pages 2 0 R >>',
        2 => '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        3 => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Logo 7 0 R' . ($photoJpeg ? ' /Im1 8 0 R' : '') . ' >> >> /Contents 4 0 R >>',
        4 => '<< /Length ' . strlen($ops) . ">>\nstream\n" . $ops . 'endstream',
        5 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        6 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ];
    $logoJpeg = file_get_contents(__DIR__ . '/../public/assets/earthsar-logo-pdf.jpg');
    $objects[7] = '<< /Type /XObject /Subtype /Image /Width 700 /Height 212 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($logoJpeg) . ">>\nstream\n" . $logoJpeg . "\nendstream";
    if ($photoJpeg) $objects[8] = '<< /Type /XObject /Subtype /Image /Width ' . $photoSize[0] . ' /Height ' . $photoSize[1] . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($photoJpeg) . ">>\nstream\n" . $photoJpeg . "\nendstream";
    ksort($objects);
    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; $offsets = [0];
    foreach ($objects as $number => $object) { $offsets[$number] = strlen($pdf); $pdf .= $number . " 0 obj\n" . $object . "\nendobj\n"; }
    $xref = strlen($pdf); $max = max(array_keys($objects)) + 1;
    $pdf .= "xref\n0 {$max}\n0000000000 65535 f \n";
    for ($n = 1; $n < $max; $n++) $pdf .= sprintf("%010d 00000 n \n", $offsets[$n] ?? 0);
    $pdf .= "trailer\n<< /Size {$max} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    return $pdf;
}

function post_client_profile() {
    global $_EMAIL_RE, $config;
    ensure_not_maintenance();
    if (!empty($_POST['website'])) _pub_json_out(['ok' => true], 201);
    $form_settings = read_public_settings()['forms']['clientProfile'];
    $enabled = fn($key) => ($form_settings['fields'][$key] ?? true) !== false;
    $flat_choices = array_values(array_map(fn($item) => $item['value'], array_filter($form_settings['options']['preferredFlat'] ?? [], fn($item) => ($item['visible'] ?? true) !== false)));

    $data = [
        'reference' => 'CP-' . strtoupper(bin2hex(random_bytes(3))),
        'name' => _pub_str($_POST['name'] ?? '', 100),
        'email' => strtolower(_pub_str($_POST['email'] ?? '', 200)),
        'phone' => _pub_str($_POST['phone'] ?? '', 30),
        'hasLinkedIn' => _pub_str($_POST['hasLinkedIn'] ?? '', 3),
        'linkedinProfile' => _pub_str($_POST['linkedinProfile'] ?? '', 250),
        'pets' => _pub_str($_POST['pets'] ?? '', 300),
        'offerDate' => _pub_str($_POST['offerDate'] ?? '', 10),
        'familyCount' => _pub_str($_POST['familyCount'] ?? '', 3),
        'familyDetails' => _pub_str($_POST['familyDetails'] ?? '', 180),
        'nativePlace' => _pub_str($_POST['nativePlace'] ?? '', 100),
        'shiftingFrom' => _pub_str($_POST['shiftingFrom'] ?? '', 100),
        'shiftDate' => _pub_str($_POST['shiftDate'] ?? '', 10),
        'education' => _pub_str($_POST['education'] ?? '', 120),
        'company' => _pub_str($_POST['company'] ?? '', 120),
        'designation' => _pub_str($_POST['designation'] ?? '', 120),
        'wifeWorks' => _pub_str($_POST['wifeWorks'] ?? '', 3),
        'wifeCompany' => _pub_str($_POST['wifeCompany'] ?? '', 120),
        'wifeDesignation' => _pub_str($_POST['wifeDesignation'] ?? '', 120),
        'preferredFlat' => _pub_str($_POST['preferredFlat'] ?? '', 40),
        'budget' => _pub_str($_POST['budget'] ?? '', 12),
        'hasPets' => _pub_str($_POST['hasPets'] ?? '', 3),
        'pets' => _pub_str($_POST['pets'] ?? '', 300)
    ];
    $errors = [];
    if (mb_strlen($data['name']) < 2) $errors['name'] = 'Enter the client\'s full name.';
    if (!preg_match($_EMAIL_RE, $data['email'])) $errors['email'] = 'Enter a valid email address.';
    if (!in_array($data['hasLinkedIn'], ['Yes','No'], true)) $errors['hasLinkedIn'] = 'Please choose Yes or No for LinkedIn.';
    if ($data['hasLinkedIn'] === 'Yes' && $enabled('linkedinProfile') && $data['linkedinProfile'] !== '' && !preg_match('~^https://(www\.)?linkedin\.com/(in|pub)/[A-Za-z0-9_%./?=&-]+$~i', $data['linkedinProfile'])) $errors['linkedinProfile'] = 'Enter a valid LinkedIn profile URL.';
    if (strlen(preg_replace('/\D/', '', $data['phone'])) < 7) $errors['phone'] = 'Enter a valid phone number.';
    if ($enabled('offerDate') && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['offerDate'])) $errors['offerDate'] = 'Choose the offer date.';
    if ($enabled('familyCount') && (!preg_match('/^\d{1,2}$/', $data['familyCount']) || (int)$data['familyCount'] < 1 || (int)$data['familyCount'] > 30)) $errors['familyCount'] = 'Enter a family size from 1 to 30.';
    if ($enabled('familyDetails') && !$data['familyDetails']) $errors['familyDetails'] = 'Add household member details.';
    if ($enabled('nativePlace') && !$data['nativePlace']) $errors['nativePlace'] = 'Enter the native place.';
    if ($enabled('shiftingFrom') && !$data['shiftingFrom']) $errors['shiftingFrom'] = 'Enter where the client is shifting from.';
    if ($enabled('shiftDate') && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['shiftDate'])) $errors['shiftDate'] = 'Choose the expected shifting date.';
    if ($enabled('education') && !$data['education']) $errors['education'] = 'Enter the educational background.';
    if ($enabled('company') && !$data['company']) $errors['company'] = 'Enter the working company or profession.';
    if ($enabled('designation') && !$data['designation']) $errors['designation'] = 'Enter the designation.';
    if (!in_array($data['wifeWorks'], ['Yes','No'], true)) $errors['wifeWorks'] = 'Please choose Yes or No.';
    if ($data['wifeWorks'] === 'Yes' && $enabled('wifeCompany') && !$data['wifeCompany']) $errors['wifeCompany'] = 'Enter your spouse’s company name.';
    if ($data['wifeWorks'] === 'Yes' && $enabled('wifeDesignation') && !$data['wifeDesignation']) $errors['wifeDesignation'] = 'Enter your spouse’s designation.';
    if ($enabled('preferredFlat') && !in_array($data['preferredFlat'], $flat_choices, true)) $errors['preferredFlat'] = 'Choose the preferred flat size.';
    if ($enabled('budget') && (!preg_match('/^\d{1,10}$/', $data['budget']) || (int)$data['budget'] < 1)) $errors['budget'] = 'Enter the monthly rental budget in rupees.';
    if (!in_array($data['hasPets'], ['Yes','No'], true)) $errors['hasPets'] = 'Please choose Yes or No for pets.';
    if (($_POST['consent'] ?? '') !== 'on') $errors['consent'] = 'Consent is required to send this profile to earthsar.';
    if ($errors) _pub_json_out(['error' => 'Check the highlighted fields.', 'fields' => $errors], 400);

    $photoJpeg = null; $photoSize = null; $photoMime = null;
    if (!empty($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE) {
        $file = $_FILES['photo'];
        if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 3 * 1024 * 1024) _pub_json_out(['error' => 'The client photo must be a JPG or PNG up to 3 MB.'], 400);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!in_array($mime, ['image/jpeg', 'image/png'], true)) _pub_json_out(['error' => 'The client photo must be a JPG or PNG image.'], 400);
        $imageInfo = @getimagesize($file['tmp_name']);
        if (!$imageInfo || $imageInfo[0] < 1 || $imageInfo[1] < 1 || $imageInfo[0] > 6000 || $imageInfo[1] > 6000 || $imageInfo[0] * $imageInfo[1] > 20000000) {
            _pub_json_out(['error' => 'Client photo dimensions are too large. Choose an image up to 20 megapixels.'], 400);
        }
        $photoMime = $mime;
        if (function_exists('imagecreatefromstring')) {
            $image = @imagecreatefromstring(file_get_contents($file['tmp_name']));
            if ($image) {
                $photoSize = [imagesx($image), imagesy($image)];
                $flattened = imagecreatetruecolor($photoSize[0], $photoSize[1]);
                $white = imagecolorallocate($flattened, 255, 255, 255);
                imagefill($flattened, 0, 0, $white);
                imagecopy($flattened, $image, 0, 0, 0, 0, $photoSize[0], $photoSize[1]);
                ob_start(); imagejpeg($flattened, null, 88); $photoJpeg = ob_get_clean();
                imagedestroy($flattened); imagedestroy($image);
            }
        }
    }

    if (!function_exists('mail')) _pub_json_out(['error' => 'Email delivery is not available. Please contact earthsar directly.'], 503);
    $pdf = _profile_pdf_build($data, $photoJpeg, $photoSize);
    $boundary = 'earthsar_' . bin2hex(random_bytes(12));
    $safeName = preg_replace('/[^A-Za-z0-9_-]+/', '-', $data['name']);
    $filename = 'earthsar-client-profile-' . trim(substr($safeName ?: 'Client', 0, 48), '-') . '.pdf';
    $from = filter_var($config['MAIL_FROM'] ?? 'info@earthsar.in', FILTER_VALIDATE_EMAIL) ?: 'info@earthsar.in';
    $subjectText = 'Client profile - ' . $data['name'] . ' - ' . $data['reference'];
    $subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';
    $headers = [
        'From: earthsar <' . $from . '>',
        'Reply-To: ' . $data['email'],
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"'
    ];
    $body = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= "A client profile was submitted through earthsar.in.\r\n\r\nClient: {$data['name']}\r\nPhone: {$data['phone']}\r\nEmail: {$data['email']}\r\nReference: {$data['reference']}\r\n\r\nThe completed client profile is attached as a PDF.";
    if (!empty($_FILES['photo']['tmp_name'])) {
        if ($photoJpeg) {
            $body .= "\r\n\r\nThe client photo is included in the PDF.";
        } else {
            $photoData = chunk_split(base64_encode(file_get_contents($_FILES['photo']['tmp_name'])));
            $photoExt = $photoMime === 'image/png' ? 'png' : 'jpg';
            $body .= "\r\n--{$boundary}\r\nContent-Type: {$photoMime}; name=\"client-photo.{$photoExt}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"client-photo.{$photoExt}\"\r\n\r\n{$photoData}";
        }
    }
    $body .= "\r\n--{$boundary}\r\nContent-Type: application/pdf; name=\"{$filename}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n" . chunk_split(base64_encode($pdf)) . "\r\n--{$boundary}--\r\n";
    if (!@mail('info@earthsar.in', $subject, $body, implode("\r\n", $headers))) {
        _pub_json_out(['error' => 'The profile email could not be sent right now. Please try again or contact earthsar directly.'], 503);
    }
    _pub_json_out(['ok' => true, 'reference' => $data['reference']], 201);
}
