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
    $ops = "";
    $ops .= _profile_pdf_rect(44, 32, 507, 3, $orange);
    $ops .= _profile_pdf_text(44, 48, 'earthsar', 20, true, $blue);
    $ops .= _profile_pdf_text(44, 72, 'SMART ADVISORS IN REAL ESTATE', 8, false, $muted);
    $ops .= _profile_pdf_text(44, 96, 'Client Profile', 23, true, $blue);
    $ops .= _profile_pdf_text(463, 106, 'REF  ' . $data['reference'], 8, true, $muted);
    $ops .= _profile_pdf_line(44, 128, 551, 128, $line, 1);

    $imageX = 44; $imageTop = 142; $imageW = 82; $imageH = 94;
    if ($photoJpeg && $photoSize) {
        [$pw, $ph] = $photoSize;
        $scale = min($imageW / max(1, $pw), $imageH / max(1, $ph));
        $drawW = $pw * $scale; $drawH = $ph * $scale;
        $drawX = $imageX + ($imageW - $drawW) / 2;
        $drawTop = $imageTop + ($imageH - $drawH) / 2;
        $ops .= sprintf("q %.2f 0 0 %.2f %.2f %.2f cm /Im1 Do Q\n", $drawW, $drawH, $drawX, 842 - $drawTop - $drawH);
        $textX = 142;
    } else $textX = 44;
    $textW = 551 - $textX;
    $ops .= _profile_pdf_text($textX, 144, 'CLIENT', 8, true, $orange);
    $name = $data['name'];
    $ops .= _profile_pdf_text($textX, 160, mb_substr($name, 0, 40), 19, true, $blue);
    $sub = trim($data['designation'] . '  ·  ' . $data['company'], ' ·');
    if ($sub !== '') $ops .= _profile_pdf_text($textX, 189, mb_substr($sub, 0, 72), 9, false, $muted);
    $ops .= _profile_pdf_line($textX, 207, 551, 207, $line, 0.7);
    $metricW = ($textW - 14) / 2;
    $ops .= _profile_pdf_text($textX, 214, 'PREFERRED FLAT', 7, true, $muted);
    $ops .= _profile_pdf_text($textX, 226, $data['preferredFlat'], 13, true, $orange);
    $ops .= _profile_pdf_text($textX + $metricW + 14, 214, 'MONTHLY BUDGET', 7, true, $muted);
    $ops .= _profile_pdf_text($textX + $metricW + 14, 226, 'INR ' . $data['budget'], 13, true, $blue);

    $ops .= _profile_pdf_text(44, 263, 'CLIENT DETAILS', 9, true, $orange);
    $ops .= _profile_pdf_line(44, 276, 551, 276, $orange, 0.8);
    $rows = [
        ['Offer date', $data['offerDate']], ['Name', $data['name']], ['Email', $data['email']], ['Phone', $data['phone']], ['LinkedIn profile', $data['linkedinProfile']],
        ['No. of family members', $data['familyCount']], ['Family members residing', $data['familyDetails']],
        ['Native place', $data['nativePlace']], ['Shifting from', $data['shiftingFrom']],
        ['Expected shifting date', $data['shiftDate']], ['Educational background', $data['education']],
        ['Working company / profession', $data['company']], ['Designation', $data['designation']],
        ['Preferred flat size', $data['preferredFlat']], ['Monthly rental budget', 'INR ' . $data['budget']], ['Pets / housing needs', $data['pets']]
    ];
    $top = 282; $labelW = 174;
    foreach ($rows as [$label, $value]) {
        $value = $value !== '' ? $value : 'Not provided';
        $lines = explode("\n", wordwrap($value, 70, "\n", true));
        $height = max(31, count($lines) * 11 + 14);
        $ops .= _profile_pdf_rect(44, $top, 507, $height, '#FFFFFF', $line);
        $ops .= _profile_pdf_rect(44, $top, $labelW, $height, $soft);
        $ops .= _profile_pdf_text(54, $top + 10, strtoupper($label), 7, true, $muted);
        foreach ($lines as $index => $valueLine) {
            $ops .= _profile_pdf_text(230, $top + 9 + ($index * 11), $valueLine, 9, false, '#182433');
        }
        $top += $height;
    }
    $ops .= _profile_pdf_text(44, 806, 'Private client information  ·  earthsar Real Estate Advisory', 8, false, $muted);

    $objects = [];
    $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    $objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    $xobjects = $photoJpeg ? ' /XObject << /Im1 7 0 R >>' : '';
    $objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >>' . $xobjects . ' >> /Contents 4 0 R >>';
    $objects[4] = '<< /Length ' . strlen($ops) . " >>\nstream\n" . $ops . 'endstream';
    $objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    $objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    if ($photoJpeg) $objects[7] = '<< /Type /XObject /Subtype /Image /Width ' . $photoSize[0] . ' /Height ' . $photoSize[1] . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($photoJpeg) . " >>\nstream\n" . $photoJpeg . "\nendstream";
    ksort($objects);
    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; $offsets = [0];
    foreach ($objects as $number => $object) {
        $offsets[$number] = strlen($pdf);
        $pdf .= $number . " 0 obj\n" . $object . "\nendobj\n";
    }
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
        'preferredFlat' => _pub_str($_POST['preferredFlat'] ?? '', 40),
        'budget' => _pub_str($_POST['budget'] ?? '', 12)
    ];
    $errors = [];
    if (mb_strlen($data['name']) < 2) $errors['name'] = 'Enter the client\'s full name.';
    if (!preg_match($_EMAIL_RE, $data['email'])) $errors['email'] = 'Enter a valid email address.';
    if ($enabled('linkedinProfile') && $data['linkedinProfile'] !== '' && !preg_match('~^https://(www\.)?linkedin\.com/(in|pub)/[A-Za-z0-9_%./?=&-]+$~i', $data['linkedinProfile'])) $errors['linkedinProfile'] = 'Enter a valid LinkedIn profile URL.';
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
    if ($enabled('preferredFlat') && !in_array($data['preferredFlat'], $flat_choices, true)) $errors['preferredFlat'] = 'Choose the preferred flat size.';
    if ($enabled('budget') && (!preg_match('/^\d{1,10}$/', $data['budget']) || (int)$data['budget'] < 1)) $errors['budget'] = 'Enter the monthly rental budget in rupees.';
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
