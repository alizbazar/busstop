<?php

require_once 'common.php';

$kamo_url = 'http://omatlahdot.hkl.fi/interfaces/kamo';
# $kamo_wsdl = "$kamo_url?wsdl"; // download this and save to ./local.wsdl
$kamo_wsdl = "./local.wsdl";
$stop = strtoupper($_REQUEST['stop']);
$max = isset($_REQUEST['max']) ? $_REQUEST['max'] : 200;

$client = new SoapClient($kamo_wsdl, array('location' => $kamo_url));

$kamoarr = $client->getStopInfo($stop);

respond(json_encode($kamoarr));

?>
