﻿/////////////////
// 立體機動裝置 //
/////////////////
/**
 * @fileoverview 玩家控制.
 *
 * @author neson@dex.tw
 */
#pragma strict


// Universal
//////////////////////////////////////////////////////////////////////

private var i : int;
private var j : int;
private var t : int;


// Constants
//////////////////////////////////////////////////////////////////////

public var MAX_SPEED = 30.0;  // 玩家在場景中的最大速度, 避免失速
public var MIN_HEIGHT = -10.0;  // 玩家在場景中的最小高度, 避免墜落
private var TDMG_WIRE_MAX_DISTANCE = 100;


// General Settings
//////////////////////////////////////////////////////////////////////

public var rotate_cam = false;  // 是否旋轉視角, 用於左右旋轉畫面平衡
public var playerName = "Player";
/* 和控制有關的設定歸類在後面 Controls 部分 */


// Character Ability
//////////////////////////////////////////////////////////////////////

public var characterSpeed = 1.0;  // 角色速度, 地面空中拉繩速度加乘參數
public var characterFlexibility = 1.0;  // 角色靈活度, 旋轉速度加乘參數


// Self Body Objects
//////////////////////////////////////////////////////////////////////

private var MainCamW : GameObject;  // Cam 的容器
private var MainCam : GameObject;  // Cam
private var TargetW : GameObject;  // 準心容器
private var Target : GameObject;  // 準心
private var TDMG : GameObject;  // 立體機動裝置
private var TDMG_Gear : GameObject;
private var TDMG_Hook_LC : GameObject;
private var TDMG_Hook_RC : GameObject;
private var TDMG_Hook_L : GameObject;
private var TDMG_Hook_R : GameObject;
private var TDMG_Jet : GameObject;

// 3DMG Wire Helpers //

private var TDMG_Aimer_L : GameObject;
private var TDMG_Aimer_R : GameObject;
private var TDMG_Attacher_L : GameObject;
private var TDMG_Attacher_R : GameObject;


// GUI
//////////////////////////////////////////////////////////////////////

private var PlayerControlGUI : GameObject;  // 控制界面
private var ThrustLever : Joystick;
private var MButton : TapButton;
private var ReleaseButton : TapButton;


private var GUIAnimateGear : GameObject;
private var TargetCrosshair : GameObject;
private var AimCrosshairL : GameObject;
private var AimCrosshairR : GameObject;


// Status
//////////////////////////////////////////////////////////////////////

public var on_ground = 0;  // 是否在地上? 0: 否, n>0: 接觸到 n 個地面物件. 由 playerFoot 維護.
private var pre_on_ground = 0;  // 上一次 update 時是否在地上?
private var pre_position : Vector3;  // 上一次 update 時的坐標
private var prev_MButton_status : int;
private var kill_mode = 0;  // 0: not killing, 1: prepare killing, 2: kill
private var hit_thing = false;  // 是否有接觸到物體?
public var prev_y = 00.0;
public var prev_velocity : Vector3;
private var TDMG_pull_target : Vector3;
public var TDMG_fire_start_time = 00.0;
private var TDMG_Hook_L_state = 0;
private var TDMG_Hook_R_state = 0;  // 0 已收回，1 收回中，2 attach，3 射出
private var TDMG_Hook_L_attach_point : Vector3;
private var TDMG_Hook_R_attach_point : Vector3;
private var TDMG_pull_y_cd = 0;
private var TDMG_pull_y_count = 0;
private var kill_cd = 0;


// Controls
//////////////////////////////////////////////////////////////////////

// Gravity //

public var gravitySensitivity = 1;
private var gravity_buffer_rate = 12;  // 緩衝區大小
private var gravity_buffer_i_x = 0;  // 緩衝區計數器
private var gravity_buffer_i_y = 0;  // 緩衝區計數器
private var InputAngle_x_buffer = new float[gravity_buffer_rate];  // 緩衝區
private var InputAngle_y_buffer = new float[gravity_buffer_rate];  // 緩衝區
for (i=0 ; i<gravity_buffer_rate ; i++) {  // 緩衝區歸零
	InputAngle_x_buffer[i] = 0;
	InputAngle_y_buffer[i] = 0;
}

/**
 * Returns the stabilized InputAngle_y.
 *
 * @return {boolean}.
 */
function GetInputAngle_y() {
	if (++gravity_buffer_i_x >= gravity_buffer_rate) gravity_buffer_i_x = 0;
	var input_acceleration_x = Input.acceleration.x;
	if (input_acceleration_x > 1) input_acceleration_x = 1;
	else if (input_acceleration_x < -1) input_acceleration_x = -1;
	InputAngle_x_buffer[gravity_buffer_i_x] = (Mathf.Asin(input_acceleration_x)/(Mathf.PI)-0)*gravitySensitivity;
	var sum = 0.0;
	for (i=0 ; i < gravity_buffer_rate ; i++) {
		sum += InputAngle_x_buffer[i];
	}
	var avg = sum/gravity_buffer_rate;
	return avg;
}

/**
 * Returns the stabilized InputAngle_x.
 *
 * @return {boolean}.
 */
function GetInputAngle_x() {
	if (++gravity_buffer_i_y >= gravity_buffer_rate) gravity_buffer_i_y = 0;
	var input_acceleration_y = Input.acceleration.y;
	if (input_acceleration_y > 1) input_acceleration_y = 1;
	else if (input_acceleration_y < -1) input_acceleration_y = -1;
	InputAngle_y_buffer[gravity_buffer_i_y] = (Mathf.Asin(-input_acceleration_y)/(Mathf.PI)-0.2)*2*gravitySensitivity;  // 導正
	var sum = 0.0;
	for (i=0 ; i < gravity_buffer_rate ; i++) {
		sum += InputAngle_y_buffer[i];
	}
	var avg = sum/gravity_buffer_rate;
	return avg;
}


// Character Animatiom
//////////////////////////////////////////////////////////////////////

private var speed_state : int;  // 0 靜止，1 走，2 跑


// Audio
//////////////////////////////////////////////////////////////////////

public var TDMG_Fire_sound : AudioClip;  // 射出 hook 的音效
public var TDMG_Hooked_sound : AudioClip;  // hook 釘住的音效
public var TDMG_Withdraw_sound : AudioClip;  // 收回 hook 音效
public var Land_sound : AudioClip;  // 落地音效
public var Kill_sound : AudioClip;  // 揮刀音效


// Helper Functions
//////////////////////////////////////////////////////////////////////

function SetGUITPixelInsetToPosition(myGUTTexture : GameObject, toHere : Vector3, steps : float) {
	var pixelInset_x = Screen.width*(toHere.x - myGUTTexture.transform.position.x) - myGUTTexture.guiTexture.pixelInset.width/2;
	var pixelInset_y = Screen.height*(toHere.y - myGUTTexture.transform.position.y) - myGUTTexture.guiTexture.pixelInset.height/2;
	myGUTTexture.guiTexture.pixelInset.x += (pixelInset_x - myGUTTexture.guiTexture.pixelInset.x)/steps;
	myGUTTexture.guiTexture.pixelInset.y += (pixelInset_y - myGUTTexture.guiTexture.pixelInset.y)/steps;
}

function SetGUITPixelInsetToCenter(myGUTTexture : GameObject, steps : float) {
	myGUTTexture.guiTexture.pixelInset.x += (-myGUTTexture.guiTexture.pixelInset.width/2 - myGUTTexture.guiTexture.pixelInset.x)/steps;
	myGUTTexture.guiTexture.pixelInset.y += (-myGUTTexture.guiTexture.pixelInset.height/2 - myGUTTexture.guiTexture.pixelInset.y)/steps;
}


// Initialize
//////////////////////////////////////////////////////////////////////

function Start () {

	// Initialize Variables //


	// Find GameObjects //

	MainCam = transform.Find("Camera Wrapper/Main Camera").gameObject;
	MainCamW = transform.Find("Camera Wrapper").gameObject;
	TargetW = transform.Find("Target Wrapper").gameObject;
	Target = transform.Find("Target Wrapper/Target").gameObject;
	TDMG = transform.Find("TDMG").gameObject;
	TDMG_Gear = transform.Find("TDMG/TDMG_Gear").gameObject;
	TDMG_Hook_LC = transform.Find("TDMG/TDMG_Hook_L_Container").gameObject;
	TDMG_Hook_RC = transform.Find("TDMG/TDMG_Hook_R_Container").gameObject;
	TDMG_Hook_L = transform.Find("TDMG/TDMG_Hook_L_Container/TDMG_Hook").gameObject;
	TDMG_Hook_R = transform.Find("TDMG/TDMG_Hook_R_Container/TDMG_Hook").gameObject;
	TDMG_Jet = transform.Find("TDMG/TDMG_Jet").gameObject;


	TDMG_Aimer_L = transform.Find("/TDMG_Aimer_L").gameObject;
	TDMG_Aimer_R = transform.Find("/TDMG_Aimer_R").gameObject;
	TDMG_Attacher_L = transform.Find("/TDMG_Attacher_L").gameObject;
	TDMG_Attacher_R = transform.Find("/TDMG_Attacher_R").gameObject;


	PlayerControlGUI = transform.Find("/Player Control GUI").gameObject;
	MButton = PlayerControlGUI.transform.Find("B_M").GetComponent("TapButton");
	ThrustLever = PlayerControlGUI.transform.Find("TL").GetComponent("Joystick");
	ReleaseButton = PlayerControlGUI.transform.Find("B_R").GetComponent("TapButton");
	TargetCrosshair = PlayerControlGUI.transform.Find("T_C").gameObject;
	AimCrosshairL = PlayerControlGUI.transform.Find("A_C_L").gameObject;
	AimCrosshairR = PlayerControlGUI.transform.Find("A_C_R").gameObject;
	GUIAnimateGear = PlayerControlGUI.transform.Find("B_M_BG2").gameObject;

	// Initialize GameObjects //

	ReleaseButton.Disable();
	MButton.UseSet(1);

}


// Update
//////////////////////////////////////////////////////////////////////

function FixedUpdate () {

	// Variables
	//////////////////////////////////////////////////////////////////

	var forward_speed = transform.InverseTransformDirection(rigidbody.velocity).z;
	var TDMG_Gear_sound = 0;
/*
	MainCam.transform.localPosition.x = 0;
	MainCam.transform.localPosition.y = 1;
	MainCam.transform.localPosition.z = -3;

*/

	// Basic Controls and Controls SFX
	//////////////////////////////////////////////////////////////////

	// Rotation (Gravity) //

	// Y (left & right)
	var input_rotate_y = GetInputAngle_y();

	if (input_rotate_y > 0.25) input_rotate_y = 0.25;  // limit
	else if (input_rotate_y < -0.25) input_rotate_y = -0.25;

	TargetW.transform.localRotation.eulerAngles.y = input_rotate_y*200;
	MainCamW.transform.localRotation.eulerAngles.y = input_rotate_y*100;
	MainCam.transform.localRotation.eulerAngles.y = input_rotate_y*-50;
	if (input_rotate_y > 0.10) {
		transform.Rotate(Vector3.up, ((input_rotate_y*characterFlexibility)-0.10)*20);
	} else if (input_rotate_y < -0.10) {
		transform.Rotate(Vector3.up, ((input_rotate_y*characterFlexibility)+0.10)*20);
	}

	// X (up & down)
	var input_rotate_x = GetInputAngle_x();

	if (input_rotate_x > 0.25) input_rotate_x = 0.25;  // limit
	else if (input_rotate_x < -0.25) input_rotate_x = -0.25;

	TargetW.transform.localRotation.eulerAngles.x = -input_rotate_x*200;
	MainCamW.transform.localRotation.eulerAngles.x = -input_rotate_x*100;

	// Debug
	//print("x " + input_rotate_x + " y " + input_rotate_y);

	// Forward (Joystick:Thrust Lever) //
	var input_forward = (ThrustLever.position.y+1)*4;  // 0~8
	if (input_forward < 1) input_forward = 0;
	if (on_ground) {  // 地上走
		if (input_forward == 0 && Mathf.Abs(input_rotate_y) > 0.10) {  // 禁止在地面定點旋轉，若要旋轉，則強制加力前進
			input_forward = 0.9 + Mathf.Abs(input_rotate_y)*2;
		}
		rigidbody.AddForce(transform.forward * ((input_forward*characterSpeed)-transform.InverseTransformDirection(rigidbody.velocity).z), ForceMode.VelocityChange);  // 前進
		rigidbody.AddForce((-1) * transform.right * (transform.InverseTransformDirection(rigidbody.velocity).x), ForceMode.VelocityChange);  // 消除左右滑動
		if (!pre_on_ground) audio.PlayOneShot(Land_sound, 1);  // 落地音效
		if (TDMG_Jet.GetComponent(AudioSource).volume > 0) TDMG_Jet.GetComponent(AudioSource).volume -= 0.05;  // 關閉噴氣音效
	} else {  // 天上飛
		rigidbody.AddForce(transform.forward * ((input_forward*characterSpeed)*1.4-transform.InverseTransformDirection(rigidbody.velocity).z) /16, ForceMode.VelocityChange);  // 前進, x1.4 /16
		rigidbody.AddForce((-1) * transform.right * (transform.InverseTransformDirection(rigidbody.velocity).x) /16, ForceMode.VelocityChange);  // 消除左右移動, /16
		if (!hit_thing) rigidbody.AddForce(transform.up * input_forward/2, ForceMode.Acceleration);

		TDMG_Jet.GetComponent(AudioSource).volume += (input_forward/100 - TDMG_Jet.GetComponent(AudioSource).volume)/10;
	}

	// Debug
	// print("v " + transform.InverseTransformDirection(rigidbody.velocity).z);


	// 3DMG Wire
	//////////////////////////////////////////////////////////////////


	// Status //

	var MButton_status;  // 0: Fire, 1: Pull, 2: Firing, 3: Releasing, 4: NoTarget.
	var TDMG_has_attached = false;  // 是否有 Attached?
	var TDMG_is_firing = false;  // 是否有 Attached?
	var TDMG_aval_hooks = 2;  // 可用 hook 數
	if (TDMG_Hook_L_state == 2 || TDMG_Hook_R_state == 2) TDMG_has_attached = true;
	if (TDMG_Hook_L_state == 3 || TDMG_Hook_R_state == 3) TDMG_is_firing = true;
	if (TDMG_Hook_L_state) TDMG_aval_hooks--;
	if (TDMG_Hook_R_state) TDMG_aval_hooks--;

	if (TDMG_Hook_L_state == 2 && TDMG_Hook_R_state == 2) {
		TDMG_pull_target = (TDMG_Attacher_L.transform.position + TDMG_Attacher_R.transform.position) / 2;
	} else if (TDMG_Hook_L_state == 2) {
		TDMG_pull_target = TDMG_Attacher_L.transform.position;
	} else if (TDMG_Hook_R_state == 2) {
		TDMG_pull_target = TDMG_Attacher_R.transform.position;
	}

	// Aim //

	var tdmg_target_ray : Ray = Ray(MainCam.transform.position, Target.transform.position - MainCam.transform.position);
	var tdmg_target_hit : RaycastHit;
	var tdmg_target_hit_in_range = false;
	var tdmg_can_side_hit = false;
	var tdmg_is_aimed = false;
	var tdmg_aimed_trans_l : Transform;
	var tdmg_aimed_trans_r : Transform;
	var tdmg_use_hook_l = false;
	var tdmg_use_hook_r = false;

	if ( Physics.Raycast(tdmg_target_ray, tdmg_target_hit) &&
	     (TDMG.transform.position - tdmg_target_hit.point).magnitude < TDMG_WIRE_MAX_DISTANCE ) {  // Case normal hit
		TDMG_Aimer_L.transform.position = tdmg_target_hit.point;
		TDMG_Aimer_R.transform.position = tdmg_target_hit.point;
		tdmg_aimed_trans_l = tdmg_target_hit.transform;
		tdmg_aimed_trans_r = tdmg_target_hit.transform;
		tdmg_target_hit_in_range = true;
		tdmg_is_aimed = true;
		if (!TDMG_Hook_R_state && (input_rotate_y > 0 || TDMG_Hook_L_state)) tdmg_use_hook_r = true;
		else tdmg_use_hook_l = true;

		if ( tdmg_target_hit.collider.gameObject.tag != "Titan" &&
		     ((TDMG_Hook_L_state == 0 && TDMG_Hook_L_state == 0) || ((TDMG_Hook_L_state != 1 && TDMG_Hook_L_state != 1) && (TDMG_pull_target - TDMG.transform.position).magnitude < 40)) &&
		     (TDMG.transform.position - tdmg_target_hit.point).magnitude < 40 ) {  // Consider to use both hooks
			var tdmg_target_ray_L : Ray = Ray(MainCam.transform.position-transform.right, Target.transform.position - MainCam.transform.position - transform.right);
			var tdmg_target_hit_L : RaycastHit;
			var tdmg_target_ray_R : Ray = Ray(MainCam.transform.position+transform.right, Target.transform.position - MainCam.transform.position + transform.right);
			var tdmg_target_hit_R : RaycastHit;

			if ( Physics.Raycast(tdmg_target_ray_L, tdmg_target_hit_L) &&
			     Physics.Raycast(tdmg_target_ray_R, tdmg_target_hit_R) ) {
				if ( (tdmg_target_hit.point - tdmg_target_hit_L.point).magnitude < 10.5 &&
				     (tdmg_target_hit.point - tdmg_target_hit_R.point).magnitude < 10.5 &&
				     TDMG.transform.InverseTransformPoint(tdmg_target_hit_L.point).z > 0 &&
				     TDMG.transform.InverseTransformPoint(tdmg_target_hit_R.point).z > 0 ) {
					TDMG_Aimer_L.transform.position = tdmg_target_hit_L.point;
					TDMG_Aimer_R.transform.position = tdmg_target_hit_R.point;
					tdmg_aimed_trans_l = tdmg_target_hit_L.transform;
					tdmg_aimed_trans_r = tdmg_target_hit_R.transform;
					tdmg_use_hook_r = true;
					tdmg_use_hook_l = true;
				}
			}
		}

	} else if (1 == -2) {  // Case sides

	} else {

	}

	// GUI //

	TargetCrosshair.transform.position = Camera.main.WorldToViewportPoint(Target.transform.position);
	if (tdmg_is_aimed) {
		if (tdmg_use_hook_l) {
			AimCrosshairL.transform.position = Camera.main.WorldToViewportPoint(Target.transform.position);
			SetGUITPixelInsetToPosition(AimCrosshairL, Camera.main.WorldToViewportPoint(TDMG_Aimer_L.transform.position), 8);
			AimCrosshairL.GetComponent(GUITextureHelper).Show();
		} else {
			SetGUITPixelInsetToCenter(AimCrosshairL, 1);
			AimCrosshairL.GetComponent(GUITextureHelper).Hide();
		}
		if (tdmg_use_hook_r) {
			AimCrosshairR.transform.position = Camera.main.WorldToViewportPoint(Target.transform.position);
			SetGUITPixelInsetToPosition(AimCrosshairR, Camera.main.WorldToViewportPoint(TDMG_Aimer_R.transform.position), 8);
			AimCrosshairR.GetComponent(GUITextureHelper).Show();
		} else {
			SetGUITPixelInsetToCenter(AimCrosshairR, 1);
			AimCrosshairR.GetComponent(GUITextureHelper).Hide();
		}
	} else {
		SetGUITPixelInsetToCenter(AimCrosshairL, 1);
		AimCrosshairL.GetComponent(GUITextureHelper).Hide();
		SetGUITPixelInsetToCenter(AimCrosshairR, 1);
		AimCrosshairR.GetComponent(GUITextureHelper).Hide();
	}

	if (TDMG_has_attached) {  // 有已 attach 的 TDMG Hook
		MButton_status = 1;
	} else if (TDMG_Hook_L_state == 3 || TDMG_Hook_R_state == 3) {  // 有射出中的 TDMG Hook
		MButton_status = 2;
	} else if (TDMG_aval_hooks > 0) {  // 有可用的 TDMG Hook
		MButton_status = 0;
		if (!tdmg_is_aimed) {  // 沒有瞄準點
			MButton_status = 4;
		}
	} else {  // 都在釋放中
		MButton_status = 3;
	}

	if (MButton_status != prev_MButton_status) {  // 切換 GUI 狀態
		switch (MButton_status) {
			case 0:
				MButton.Enable();
				MButton.UseSet(1);
				ReleaseButton.Disable();
				ReleaseButton.UseSet(0);
				break;
			case 1:
				MButton.Enable();
				MButton.UseSet(2);
				ReleaseButton.Enable();
				ReleaseButton.UseSet(0);
				break;
			case 2:
				MButton.Enable();
				MButton.UseSet(0);
				ReleaseButton.Disable();
				ReleaseButton.UseSet(0);
				break;
			case 3:
				MButton.Enable();
				MButton.UseSet(0);
				ReleaseButton.Disable();
				ReleaseButton.UseSet(1);
				break;
			case 4:
				MButton.Enable();
				MButton.UseSet(0);
				ReleaseButton.Disable();
				ReleaseButton.UseSet(0);
				break;
		}
	}

	if (MButton_status == 2) {
		GUIAnimateGear.GetComponent(GUITextureHelper).LRotateV( -10 );
	} else if (MButton_status == 3) {
		GUIAnimateGear.GetComponent(GUITextureHelper).LRotateV( 10 );
	}

	if (MButton_status == 0 && MButton.tapped) {  // Fire!
		TDMG.audio.PlayOneShot(TDMG_Fire_sound, 1);
		TDMG_fire_start_time = Time.time;
		if (tdmg_use_hook_l) {
			TDMG_Attacher_L.transform.position = TDMG_Aimer_L.transform.position;  // 將 TDMG_Attacher 移至擊中點
			TDMG_Attacher_L.transform.parent = tdmg_aimed_trans_l;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
			TDMG_Hook_L_state = 3;
		}

		if (tdmg_use_hook_r) {
			TDMG_Attacher_R.transform.position = TDMG_Aimer_R.transform.position;  // 將 TDMG_Attacher 移至擊中點
			TDMG_Attacher_R.transform.parent = tdmg_aimed_trans_r;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
			TDMG_Hook_R_state = 3;
		}

	}

	if (MButton_status == 1 && MButton.held) {  // Pull!

		// Var
		var tdmg_pull_to_v = (Vector3.Project(rigidbody.velocity, (TDMG_pull_target - transform.position).normalized).magnitude);

		// Pull
		if ((transform.position - TDMG_pull_target).magnitude > 0.1) {
			var tdmg_wire_speed = (12 - Vector3.Project(rigidbody.velocity, (TDMG_pull_target - transform.position).normalized).magnitude);
			if (tdmg_wire_speed < 0) tdmg_wire_speed = 0;
			if (((pre_position.y-TDMG_pull_target.y) > (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y) && (transform.position.y-TDMG_pull_target.y) < (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y)) || ((pre_position.y-TDMG_pull_target.y) < (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y) && (transform.position.y-TDMG_pull_target.y) > (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y)) || ((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).magnitude < 0.1)) {
				TDMG_pull_y_cd = 10;
				TDMG_pull_y_count++;
			}
			if (TDMG_pull_y_count < 2) {
				if (!TDMG_pull_y_cd) {
					rigidbody.AddForce((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized * tdmg_wire_speed, ForceMode.VelocityChange);  // 向繩索方向加力
				} else {
					rigidbody.AddForce(((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized - Vector3.up*(TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized.y) * tdmg_wire_speed, ForceMode.VelocityChange);  // 向繩索方向加力
					TDMG_pull_y_cd--;
				}
			} else {  // 避免出現 Y 軸簡諧運動
				rigidbody.AddForce(((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized - Vector3.up*(TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized.y) * tdmg_wire_speed, ForceMode.VelocityChange);  // 向繩索方向加力
				var yfa = (TDMG_pull_target.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y)/3;
				yfa -= rigidbody.velocity.y/12;
				rigidbody.AddForce(transform.up*(yfa), ForceMode.VelocityChange);
			}

			TDMG_Gear.GetComponent(AudioSource).volume += (tdmg_pull_to_v - (TDMG_Gear.GetComponent(AudioSource).volume))/10;  // 音效
			GUIAnimateGear.GetComponent(GUITextureHelper).LRotateV( tdmg_pull_to_v/2 );
		}
	} else {
		TDMG_pull_y_cd = 0;
		TDMG_pull_y_count = 0;
		TDMG_Gear.GetComponent(AudioSource).volume = 0;
	}

	if (ReleaseButton.tapped) {  // Release!
		if (TDMG_Hook_L_state == 2) TDMG_Hook_L_state = 1;
		if (TDMG_Hook_R_state == 2) TDMG_Hook_R_state = 1;
	}

	// Hook Behavior //

	if (TDMG_Hook_L_state == 3) {  // 若射出中
		TDMG_Hook_L.transform.position += (TDMG_Attacher_L.transform.position - TDMG_Hook_L.transform.position).normalized;
		TDMG_Gear_sound = 1;
		if (Time.time - TDMG_fire_start_time > 2.5) {  // 超時
			TDMG_Hook_L_state = 1;  // 收回
		} else if ((TDMG_Attacher_L.transform.position - TDMG_Hook_L.transform.position).magnitude < 0.8) {  // 中
			TDMG_Hook_L_state = 2;
			TDMG_Attacher_L.audio.PlayOneShot(TDMG_Hooked_sound, 1);
		}
	} else if (TDMG_Hook_L_state == 2) {
		TDMG_Hook_L.transform.position = TDMG_Attacher_L.transform.position;
	} else if (TDMG_Hook_L_state == 1) {
		TDMG_Hook_L.transform.position += (TDMG_Hook_LC.transform.position - TDMG_Hook_L.transform.position).normalized;
		TDMG_Gear_sound = 1;
		if ((TDMG_Hook_LC.transform.position - TDMG_Hook_L.transform.position).magnitude < 0.8) {
			TDMG_Hook_L.transform.position = TDMG_Hook_LC.transform.position;  // 完成回收
			TDMG_Hook_L_state = 0;
			TDMG.audio.PlayOneShot(TDMG_Withdraw_sound, 1);
		}
	}

	if (TDMG_Hook_R_state == 3) {  // 若射出中
		TDMG_Hook_R.transform.position += (TDMG_Attacher_R.transform.position - TDMG_Hook_R.transform.position).normalized;
		TDMG_Gear_sound = 1;
		if (Time.time - TDMG_fire_start_time > 2) {  // 超時
			TDMG_Hook_R_state = 1;  // 收回
		} else if ((TDMG_Attacher_R.transform.position - TDMG_Hook_R.transform.position).magnitude < 0.8) {  // 中
			TDMG_Hook_R_state = 2;
			TDMG_Attacher_R.audio.PlayOneShot(TDMG_Hooked_sound, 1);
			//TDMG_Attacher.GetComponent(ConfigurableJoint).linearLimit.limit = (transform.position - TDMG_Attacher_R.transform.position).magnitude;
		}
	} else if (TDMG_Hook_R_state == 2) {
		TDMG_Hook_R.transform.position = TDMG_Attacher_R.transform.position;
	} else if (TDMG_Hook_R_state == 1) {
		TDMG_Hook_R.transform.position += (TDMG_Hook_RC.transform.position - TDMG_Hook_R.transform.position).normalized;
		TDMG_Gear_sound = 1;
		if ((TDMG_Hook_RC.transform.position - TDMG_Hook_R.transform.position).magnitude < 0.8) {
			TDMG_Hook_R.transform.position = TDMG_Hook_RC.transform.position;  // 完成回收
			TDMG_Hook_R_state = 0;
			TDMG.audio.PlayOneShot(TDMG_Withdraw_sound, 1);
		}
	}

	// 總體狀態，及 GUI 反應 //

	//var ReleaseButton_status = 1;  // 0: Release, 1: Releaseing, 2: Disabled
/*
	if (TDMG_Hook_L_state + TDMG_Hook_R_state <= 1 ) {  // 有可用的 TDMG Hook，且皆已收回或收回中
		MButton_status = 0;
		ReleaseButton_status = 2;
		//TDMG_Attacher.GetComponent(ConfigurableJoint).linearLimit.limit = Mathf.Infinity;

	} else if (TDMG_Hook_L_state == 2 || TDMG_Hook_R_state == 2) {  // 有已 attach 的 TDMG Hook
		MButton_status = 1;
		//if ((transform.position - TDMG_Attacher.transform.position).magnitude > 2) {  // 最短兩公尺
			//TDMG_Attacher.GetComponent(ConfigurableJoint).linearLimit.limit = (transform.position - TDMG_Attacher.transform.position).magnitude;  // 限制繩長，拉回不再放
		//}
		//print((transform.position - TDMG_Attacher.transform.position).magnitude);
		ReleaseButton_status = 0;

	} else if (TDMG_Hook_L_state == 3 || TDMG_Hook_R_state == 3) {  // 有射出中的 TDMG Hook
		MButton_status = 2;
		ReleaseButton_status = 2;
		//TDMG_Attacher.GetComponent(ConfigurableJoint).linearLimit.limit = Mathf.Infinity;
	}
*/
/*	// 按鍵行為 //
	var is_fire_hit = false;
	var heading = MainCam.transform.position - Target.transform.position;  // 取得瞄準方向
	var fire_ray : Ray = Ray(MainCam.transform.position, -1*heading);
	var fire_hit : RaycastHit;
	var fire_hit_p_L : Vector3;
	var fire_hit_p_R : Vector3;
	if (Physics.Raycast(fire_ray, fire_hit)) {  // 取得擊中點 (fire_hit.point)
		Debug.DrawLine(fire_ray.origin, fire_hit.point);
		if ((transform.position - fire_hit.point).magnitude < TDMG_WIRE_MAX_DISTANCE) {
			is_fire_hit = true;
			// Aim.guiTexture.texture = Aim_aim_texture;
		} else {
			// Aim.guiTexture.texture = Aim_texture;
		}
	}*/
/*
	if (MButton_status == 0) {  // Fire
		// MButton.guiTexture.texture = MButton_texture;

		if (MButton.tapped == true) {  // Fire TDMG Hook

			if (is_fire_hit) {
				TDMG.audio.PlayOneShot(TDMG_Fire_sound, 1);
				Debug.DrawLine(fire_ray.origin, fire_hit.point);
	//			TDMG_Attacher.transform.position = fire_hit.point;  // 將 TDMG_Attacher 移至擊中點
	//			TDMG_Attacher.transform.parent = fire_hit.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上

				var fire_ray_L : Ray = Ray(MainCam.transform.position-transform.right, -1*heading-transform.right);
				var fire_hit_L : RaycastHit;
				var fire_ray_R : Ray = Ray(MainCam.transform.position+transform.right, -1*heading+transform.right);
				var fire_hit_R : RaycastHit;
				var use_hook_L = false;
				var use_hook_R = false;

				if (fire_hit.collider.gameObject.tag != "Titan") {
					if (!TDMG_Hook_L_state && Physics.Raycast(fire_ray_L, fire_hit_L)) {  // 取得左右擊中點
						if ((fire_hit.point - fire_hit_L.point).magnitude < 10.5) {

							use_hook_L = true;
							TDMG_Attacher_L.transform.position = fire_hit_L.point;  // 將 TDMG_Attacher 移至擊中點
							TDMG_Attacher_L.transform.parent = fire_hit_L.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
						}
					}

					if (!TDMG_Hook_R_state && Physics.Raycast(fire_ray_R, fire_hit_R)) {  // 取得左右擊中點

						if ((fire_hit.point - fire_hit_R.point).magnitude < 10.5) {
							use_hook_R = true;
							TDMG_Attacher_R.transform.position = fire_hit_R.point;  // 將 TDMG_Attacher 移至擊中點
							TDMG_Attacher_R.transform.parent = fire_hit_R.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
						}
					}
				}

				if (!use_hook_L || !use_hook_R) {  // 其中一 hook 無法使用？
					if (TDMG_Hook_L_state != 0) {
						use_hook_R = true;
						TDMG_Attacher_R.transform.position = fire_hit.point;  // 將 TDMG_Attacher 移至擊中點
						TDMG_Attacher_R.transform.parent = fire_hit.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
					} else if (TDMG_Hook_R_state != 0) {
						use_hook_L = true;
						TDMG_Attacher_L.transform.position = fire_hit.point;  // 將 TDMG_Attacher 移至擊中點
						TDMG_Attacher_L.transform.parent = fire_hit.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
					} else {
						if (input_rotate_y > 0) {
							use_hook_R = true;
							TDMG_Attacher_R.transform.position = fire_hit.point;  // 將 TDMG_Attacher 移至擊中點
							TDMG_Attacher_R.transform.parent = fire_hit.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
						} else {
							use_hook_L = true;
							TDMG_Attacher_L.transform.position = fire_hit.point;  // 將 TDMG_Attacher 移至擊中點
							TDMG_Attacher_L.transform.parent = fire_hit.transform;  // 將 TDMG_Attacher 的 parent 設為被擊中物件，等同將 TDMG_Attacher attach 到被擊中物件上
						}
					}
				}

				// 射出 Hook，並開始計時
				TDMG_fire_start_time = Time.time;
				if (use_hook_L) TDMG_Hook_L_state = 3;
				if (use_hook_R) TDMG_Hook_R_state = 3;
			}

		}


	} */

	/*
	if (MButton_status == 1) {  // Pull
		// MButton.guiTexture.texture = MButton_texture_pull;

		if (MButton.held == true) {
			var TDMG_pull_target : Vector3;
			if (TDMG_Hook_L_state == 2 && TDMG_Hook_R_state == 2) {
				TDMG_pull_target = (TDMG_Attacher_L.transform.position + TDMG_Attacher_R.transform.position) / 2;
			} else if (TDMG_Hook_L_state == 2) {
				TDMG_pull_target = TDMG_Attacher_L.transform.position;
			} else if (TDMG_Hook_R_state == 2) {
				TDMG_pull_target = TDMG_Attacher_R.transform.position;
			}
			if ((transform.position - TDMG_pull_target).magnitude > 0.1) {
				// MButton.guiTexture.texture = MButton_texture_pull_pulled;
				var tdmg_wire_speed = (12 - Vector3.Project(rigidbody.velocity, (TDMG_pull_target - transform.position).normalized).magnitude);
				if (tdmg_wire_speed < 0) tdmg_wire_speed = 0;
				if (((pre_position.y-TDMG_pull_target.y) > (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y) && (transform.position.y-TDMG_pull_target.y) < (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y)) || ((pre_position.y-TDMG_pull_target.y) < (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y) && (transform.position.y-TDMG_pull_target.y) > (transform.position.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y)) || ((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).magnitude < 0.1)) {
					TDMG_pull_y_cd = 10;
					TDMG_pull_y_count++;
				}
				if (TDMG_pull_y_count < 2) {
					if (!TDMG_pull_y_cd) {
						rigidbody.AddForce((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized * tdmg_wire_speed, ForceMode.VelocityChange);  // 向繩索方向加力
					} else {
						rigidbody.AddForce(((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized - Vector3.up*(TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized.y) * tdmg_wire_speed, ForceMode.VelocityChange);  // 向繩索方向加力
						TDMG_pull_y_cd--;
					}
				} else {  // 避免出現 Y 軸簡諧運動
					rigidbody.AddForce(((TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized - Vector3.up*(TDMG_pull_target - (TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).normalized.y) * tdmg_wire_speed, ForceMode.VelocityChange);  // 向繩索方向加力
					var yfa = (TDMG_pull_target.y - ((TDMG_Hook_LC.transform.position + TDMG_Hook_RC.transform.position)/2).y)/3;
					yfa -= rigidbody.velocity.y/12;
					rigidbody.AddForce(transform.up*(yfa), ForceMode.VelocityChange);
				}

				TDMG_Gear.GetComponent(AudioSource).volume += ((Vector3.Project(rigidbody.velocity, (TDMG_pull_target - transform.position).normalized).magnitude) - (TDMG_Gear.GetComponent(AudioSource).volume))/10;
			}
		} else {
			// MButton.guiTexture.texture = MButton_texture_pull;
			TDMG_pull_y_cd = 0;
			TDMG_pull_y_count = 0;
		}

	} else {
		// MButton.guiTexture.texture = MButton_texture_disabled;
	}
*/
/*	if (ReleaseButton_status == 0) {  // 可用
		// ReleaseButton.guiTexture.texture = ReleaseButton_texture;
		if (ReleaseButton.tapped == true) {
			if (TDMG_Hook_L_state == 2) TDMG_Hook_L_state = 1;
			if (TDMG_Hook_R_state == 2) TDMG_Hook_R_state = 1;
		}
	} else if (ReleaseButton_status == 1) {  // 已按
		// ReleaseButton.guiTexture.texture = ReleaseButton_texture_released;
	} else {
		// ReleaseButton.guiTexture.texture = ReleaseButton_texture_disabled;
	}*/

	// Hook 物理行為，依 Status 依序定義 //
	/////...


	// input_rotate_x
	//print(TargetW.transform.position);
	//print(TDMG_Attacher.transform.position);

	// Kill
	//////////////////////////////////////////////////////////////////

	if (kill_mode == 2) {
		audio.PlayOneShot(Kill_sound, 1);
	}


	// Moving Animation
	//////////////////////////////////////////////////////////////////

	// Decide speed state
	if (speed_state == 0 && rigidbody.velocity.magnitude > 0.01)  // 0 to 1
		speed_state = 1;
	else if (speed_state == 1 && rigidbody.velocity.magnitude > 3.7)  // 1 to 2
		speed_state = 2;
	else if (speed_state == 2 && rigidbody.velocity.magnitude < 3.2) // 2 to 1
		speed_state = 1;
	else if (rigidbody.velocity.magnitude < 0.05) speed_state = 0;  // all to 0

	if (on_ground) {  // On grond animation
		TDMG_Jet.particleEmitter.minEmission = 0;
		TDMG_Jet.particleEmitter.maxEmission = 0;
		if (speed_state == 1) {
			animation.CrossFade("Walk", 0.2);
			animation["Walk"].speed = rigidbody.velocity.magnitude/2.2;
		} else if (speed_state == 2) {
			animation.CrossFade("Run", 0.2);
			animation["Run"].speed = rigidbody.velocity.magnitude/5;
		} else if (speed_state == 0) {
			animation.CrossFade("Stand", 0.2);
		}
	} else {  //Flying
		var TDMG_jet_air_amount = Mathf.Sqrt(input_forward)*2.828;
		TDMG_Jet.particleEmitter.enabled = true;
		TDMG_Jet.particleEmitter.localVelocity = Vector3(0, -(TDMG_jet_air_amount));
		TDMG_Jet.particleEmitter.minEmission = TDMG_jet_air_amount*100;
		TDMG_Jet.particleEmitter.maxEmission = TDMG_jet_air_amount*200;
		TDMG_Jet.particleEmitter.minEnergy = TDMG_jet_air_amount*0.001;
		TDMG_Jet.particleEmitter.maxEnergy = TDMG_jet_air_amount*0.1;
		TDMG_Jet.particleEmitter.rndVelocity = Vector3(TDMG_jet_air_amount*0.1, TDMG_jet_air_amount*0.1, TDMG_jet_air_amount*0.1);
		if (Random.Range(8,0.1) <= input_forward) {  // 氣體噴出量，(input_forward) = 8(全速) ~ 0(stop)
			//var TDMG_Gas_s = Instantiate(TDMG_Gas);
			//TDMG_Gas_s.transform.position = TDMG_Jet.transform.position;
			//TDMG_Gas_s.rigidbody.AddForce(TDMG_Jet.transform.input_forward);
		}

		if (!kill_cd) {
			if (kill_mode == 1) {  // 準備擊殺
				animation.CrossFade("PreKill", 0.5);  // 準備揮刀
			} else if (kill_mode == 2) {  // 擊殺
				animation.Play("Kill");
				animation.CrossFadeQueued("Fly", 10);
			} else if (transform.position.y < prev_y+0.01) {  // 沒在上昇
				animation.CrossFade("Fly2", 0.5);
			} else {  // 在上昇
				animation.CrossFade("Fly", 0.2);
			}
		}

	}


	// Camera
	//////////////////////////////////////////////////////////////////

	//MainCam.camera.fieldOfView += ((72 + forward_speed*2 - 8) - MainCam.camera.fieldOfView)/10;
	var cam_dist = (-3 - forward_speed/4 + 1);
	if (cam_dist > -2) cam_dist = -2;
	MainCam.transform.localPosition.z += (cam_dist - MainCam.transform.localPosition.z)/10;

	var MainCam_behind_ray : Ray = Ray(MainCamW.transform.position+MainCamW.transform.up, -MainCamW.transform.forward);
	var MainCam_behind_ray_hit : RaycastHit;
	Physics.Raycast(MainCam_behind_ray, MainCam_behind_ray_hit);
	var MainCam_behind_distance = (MainCamW.transform.position+MainCamW.transform.up - MainCam_behind_ray_hit.point).magnitude;
	if (MainCam_behind_distance < -MainCam.transform.localPosition.z+0.1) {
		MainCam.transform.localPosition.z = -MainCam_behind_distance+0.1;
	}

	// Debug //
	//print("MCFieldOfView " + MainCam.camera.fieldOfView);
	// Debug.DrawLine(MainCamW.transform.position+MainCamW.transform.up, MainCam_behind_ray_hit.point);
	//Debug.DrawLine(MainCamW.transform.position+MainCamW.transform.up+MainCam.transform.forward, MainCamW.transform.position+MainCamW.transform.up);
	//print("MainCam_behind_distance " + MainCam_behind_distance);
	//print("MainCam.transform.forward " + MainCam.transform.forward);
	//print("MainCam.transform.forward " + MainCam.transform.forward);


	// Update var
	//////////////////////////////////////////////////////////////////

	prev_y = transform.position.y;
	prev_velocity = rigidbody.velocity;
	prev_MButton_status = MButton_status;
	if (kill_cd) kill_cd--;
	if (kill_mode == 2) kill_cd = 50;
	kill_mode = 0;
	pre_on_ground = on_ground;
	pre_position = transform.position;
	hit_thing = false;

	// 被動避免失速
	if(rigidbody.velocity.magnitude > MAX_SPEED) {
		rigidbody.velocity = rigidbody.velocity.normalized * MAX_SPEED;
	}
	if(rigidbody.velocity.y > MAX_SPEED/3) {
		rigidbody.velocity.y = MAX_SPEED/3;
	}
}


function Update () {
	TDMG_Hook_LC.GetComponent(LineRenderer).SetPosition(0, TDMG_Hook_L.transform.position);
	TDMG_Hook_LC.GetComponent(LineRenderer).SetPosition(1, TDMG_Hook_LC.transform.position);
	TDMG_Hook_RC.GetComponent(LineRenderer).SetPosition(0, TDMG_Hook_R.transform.position);
	TDMG_Hook_RC.GetComponent(LineRenderer).SetPosition(1, TDMG_Hook_RC.transform.position);
}


function OnTriggerStay (what : Collider) {
	if (what.gameObject.name == "Kill Range") {
		if (kill_mode == 0) kill_mode = 1;
	}
}


function OnTriggerEnter(what : Collider) {
	if (what.gameObject.name == "Kill Point") {
		kill_mode = 2;
		what.transform.root.gameObject.GetComponent(TitanAI).Die();
	}
}


function OnCollisionStay(what : Collision) {
    if(what.gameObject.name == "Terrain" || what.gameObject.tag == "Wall" || what.gameObject.tag == "Building" || what.gameObject.name == "wall" || what.gameObject.name == "house1") {
		hit_thing = true;
	}
}
