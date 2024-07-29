---
layout: post
title: Centos7 搭建L2TP+IPsec VPN
date: 2023-02-22 23:27:20
tags:
  - posts
  - linux
thumbnail: https://images.unsplash.com/photo-1603985529862-9e12198c9a60?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8dnBufGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=800&q=60
---

# Centos7 搭建L2TP+IPsec VPN

L2TP是一种工业标准的Internet隧道协议，功能大致和PPTP协议类似，比如同样可以对网络数据流进行加密。<!-- more -->不过也有不同之处，比如PPTP要求网络为IP网络，L2TP要求面向数据包的点对点连接；PPTP使用单一隧道，L2TP使用多隧道；L2TP提供包头压缩、隧道验证，而PPTP不支持。L2TP本身不提供加密功能, 经常搭配IPsec加密协议一起使用, 可以提供比PPTP更高级别的数据加密。

## 前期准备

检查L2TP需要的环境支持

```bash
# 查看主机是否支持pptp，返回结果为yes就表示通过
modprobe ppp-compress-18 && echo yes
# 查看是否开启了TUN
# 有的虚拟机主机需要开启，返回结果为cat: /dev/net/tun: File descriptor in bad state或cat: /dev/net/tun: 文件描述符处于错误状态。就表示通过。
cat /dev/net/tun
```

## 安装

需要安装的软件

- ppp: 提供用户名密码验证功能，实现 VPN 的用户账号密码验证 (Centos7.x已经自带)
- libreswan: 提供 IPsec 功能，加密 IP 数据包
- xl2tpd: 提供 VPN 功能，依赖于 ppp 和 libreswan

开始安装

```bash
# 先更新
yum install update
yum update -y

# 安装EPEL源，因为CentOS7官方源中已经去掉了xl2tpd
yum install -y epel-release

# 安装xl2tpd和libreswan（libreswan用以实现IPSec，原先的openswan已经停止维护）
yum install -y xl2tpd libreswan lsof

#安装iptables防火墙，一般都有自带
yum install iptables
```

## 配置

### xl2tpd

配置文件`/etc/xl2tpd/xl2tpd.conf`

```bash
;
; This is a minimal sample xl2tpd configuration file for use
; with L2TP over IPsec.
;
; The idea is to provide an L2TP daemon to which remote Windows L2TP/IPsec
; clients connect. In this example, the internal (protected) network
; is 192.168.1.0/24.  A special IP range within this network is reserved
; for the remote clients: 192.168.1.128/25
; (i.e. 192.168.1.128 ... 192.168.1.254)
;
; The listen-addr parameter can be used if you want to bind the L2TP daemon
; to a specific IP address instead of to all interfaces. For instance,
; you could bind it to the interface of the internal LAN (e.g. 192.168.1.98
; in the example below). Yet another IP address (local ip, e.g. 192.168.1.99)
; will be used by xl2tpd as its address on pppX interfaces.

[global]
; listen-addr = 172.16.0.12 # 这里我使用了默认配置, 也就是绑定端口到0.0.0.0
;
; requires openswan-2.5.18 or higher - Also does not yet work in combination
; with kernel mode l2tp as present in linux 2.6.23+
ipsec saref = yes
; Use refinfo of 22 if using an SAref kernel patch based on openswan 2.6.35 or
;  when using any of the SAref kernel patches for kernels up to 2.6.35.
; saref refinfo = 30
;
; force userspace = yes
;
; debug tunnel = yes
auth file = /etc/ppp/chap-secrets
port = 1701

[lns default]
ip range = 192.168.100.128-192.168.100.254 # 设置的vpn客户端IP地址段
local ip = 192.168.100.1 # 本机分配的vpn IP地址, 保持同一个段
require chap = yes
refuse pap = yes
require authentication = yes
name = LinuxVPNserver
ppp debug = yes
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
```

### ppp

配置文件`/etc/ppp/options.xl2tpd`

```bash
ipcp-accept-local
ipcp-accept-remote
ms-dns  8.8.8.8
ms-dns  8.8.4.4
# ms-dns  192.168.1.1
# ms-dns  192.168.1.3
# ms-wins 192.168.1.2
# ms-wins 192.168.1.4
name l2tpd
noccp
auth
#obsolete: crtscts
crtscts
idle 1800
mtu 1410
mru 1410
nodefaultroute
debug
#obsolete: lock
lock
proxyarp
connect-delay 5000
# To allow authentication against a Windows domain EXAMPLE, and require the
# user to be in a group "VPN Users". Requires the samba-winbind package
# require-mschap-v2
# plugin winbind.so
# ntlm_auth-helper '/usr/bin/ntlm_auth --helper-protocol=ntlm-server-1 --require-membership-of="EXAMPLE\\VPN Users"'
# You need to join the domain on the server, for example using samba:
# http://rootmanager.com/ubuntu-ipsec-l2tp-windows-domain-auth/setting-up-openswan-xl2tpd-with-native-windows-clients-lucid.html

refuse-pap
refuse-chap
refuse-mschap
require-mschap-v2 # Windows连接必须设置
persist
logfile /var/log/xl2tpd.log
```

### IPsec

主配置文件`/etc/ipsec.conf`

```bash
# /etc/ipsec.conf - Libreswan IPsec configuration file
#
# see 'man ipsec.conf' and 'man pluto' for more information
#
# For example configurations and documentation, see https://libreswan.org/wiki/

config setup
        protostack=netkey
        dumpdir=/var/run/pluto/
        # Normally, pluto logs via syslog.
        #logfile=/var/log/pluto.log
        #
        # Do not enable debug options to debug configuration issues!
        #
        # plutodebug="control parsing"
        # plutodebug="all crypt"
        # plutodebug=none
        #
        # NAT-TRAVERSAL support
        # exclude networks used on server side by adding %v4:!a.b.c.0/24
        # It seems that T-Mobile in the US and Rogers/Fido in Canada are
        # using 25/8 as "private" address space on their wireless networks.
        # This range has never been announced via BGP (at least up to 2015)
        virtual_private=%v4:10.0.0.0/8,%v4:192.168.0.0/16,%v4:172.16.0.0/12,%v4:25.0.0.0/8,%v4:100.64.0.0/10,%v6:fd00::/8,%v6:fe80::/10

# if it exists, include system wide crypto-policy defaults
# include /etc/crypto-policies/back-ends/libreswan.config

# It is best to add your IPsec connections as separate files in /etc/ipsec.d/
include /etc/ipsec.d/*.conf
```

:::info

- 第一行config setup必须左对齐，即前面不能有空格，否则会报错
- 其他每一行都必须以Tab开头，否则会报错
- 如果安装的是 openswan，可能需要在 config setup 之前添加 version 2.0
  :::

在`/etc/ipsec.secrets`中设置PSK密钥

```bash
# 格式为 服务器IP %any: PSK “预共享密钥”，其中 %any: 和 PSK 之间有空格
[服务器外网IP] %any: PSK "123456abcdefg"
```

接着继续配置服务器, 修改配置文件`/etc/ipsec.d/l2tp-ipsec.conf`

```bash
conn L2TP-PSK-NAT
    rightsubnet=vhost:%priv
    dpddelay=10
    dpdtimeout=20
    dpdaction=clear
    forceencaps=yes
    also=L2TP-PSK-noNAT
conn L2TP-PSK-noNAT
    authby=secret
    pfs=no
    auto=add
    keyingtries=3
    rekey=no
    ikelifetime=8h
    keylife=1h
    type=transport
    left=1.14.239.60
    leftprotoport=17/1701
    right=%any
    rightprotoport=17/%any
```

:::info

- conn开头的两行必须左对齐，开头不能有空格，其他每一行必须以Tab缩进
- left 此时也要填服务器的外网IP
  :::

### 添加账号密码

配置文件`/etc/ppp/chap-secrets`

```bash
# Secrets for authentication using CHAP
# client        server  secret                  IP addresses
vpntest l2tpd 123456 192.168.100.129
```

这里我习惯性的给用户指定固定IP, 方便管理, 如果你是使用`*`代替, 那就会自动分配指定段的IP地址

### 开启内核转发

配置文件`/etc/sysctl.conf`

```bash
# Kernel sysctl configuration file for Red Hat Linux
#
# For binary values, 0 is disabled, 1 is enabled.  See sysctl(8) and
# sysctl.conf(5) for more details.
#
# Use '/sbin/sysctl -a' to list all possible parameters.

# Controls IP packet forwarding
net.ipv4.ip_forward = 1            #此处的值改为1，开启内核转发

# Controls source route verification

# Do not accept source routing
net.ipv4.conf.default.accept_source_route = 0

# Controls the System Request debugging functionality of the kernel
kernel.sysrq = 0

# Controls whether core dumps will append the PID to the core filename.
# Useful for debugging multi-threaded applications.
kernel.core_uses_pid = 1

# Controls the use of TCP syncookies

# Controls the default maxmimum size of a mesage queue
kernel.msgmnb = 65536

# Controls the maximum size of a message, in bytes
kernel.msgmax = 65536

# Controls the maximum shared segment size, in bytes
kernel.shmmax = 68719476736

# Controls the maximum number of shared memory segments, in pages
kernel.shmall = 4294967296

vm.swappiness = 0
net.ipv4.neigh.default.gc_stale_time = 120


# see details in https://help.aliyun.com/knowledge_detail/39428.html
net.ipv4.conf.all.rp_filter = 0
net.ipv4.conf.default.rp_filter = 0                #此处的值必须是0
net.ipv4.conf.default.arp_announce = 2
net.ipv4.conf.lo.arp_announce=2
net.ipv4.conf.all.arp_announce=2
net.ipv4.conf.all.send_redirects = 0               #添加这几行
net.ipv4.conf.default.send_redirects = 0           #添加这几行
net.ipv4.conf.all.log_martians = 0                 #添加这几行
net.ipv4.conf.default.log_martians = 0             #添加这几行
net.ipv4.conf.all.accept_redirects = 0             #添加这几行
net.ipv4.conf.default.accept_redirects = 0         #添加这几行
net.ipv4.icmp_ignore_bogus_error_responses = 1     #添加这几行

# see details in https://help.aliyun.com/knowledge_detail/41334.html
net.ipv4.tcp_max_tw_buckets = 5000
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_synack_retries = 2
```

完了, 重载内核配置

```bash
sysctl -p
```

### 配置ip转发

```bash
## ip为服务器内网ip
iptables -t nat -A POSTROUTING -s 192.168.0.0/24 -o eth1 -j MASQUERADE

## 查看nat配置
iptables -t nat -L -n
```

## 启动

```bash
## xl2tpd debug 模式, 可以实时查看运行日志
xl2tpd -D

## IPsec状态检验, 如果有[FAILED]就不行, 需要对症解决
ipsec verify

## 启动
systemctl start ipsec
systemctl start xl2tpd

## 查看状态
systemctl status ipsec
systemctl status xl2tpd

## 设置开机启动
systemctl enable ipsec
systemctl enable xl2tpd
```

## Windows客户端配置

1. `windows+r`打开运行，输入`services.msc`，查找`ipsec policy agent`，启用服务
2. 打开注册表，路径`HKEY_LOCAL_MACHINE\System\CurrentControlSet\Services\Rasman\Parameters`
   - 添加DWORD值(32位)值，名称`ProhibitIpSec`，值为 1
   - 由于缺省的 Windows XP L2TP 传输策略不允许不使用 IPSec 加密的 L2TP 传输，修改`AllowL2TPWeakCrypto`的值为`1`
   - 重启电脑

## Linux客户端配置

> 以Centos 7为例

1. 安装 VPN 客户端

```bash
yum -y install epel-release
yum -y install strongswan xl2tpd

## 设置 VPN 变量
VPN_SERVER_IP='VPN服务器IP'
VPN_IPSEC_PSK='PSK密钥'
VPN_USERNAME='用户名'
VPN_PASSWORD='密码'
```

2. 配置strongSwan

```bash
cat > /etc/ipsec.conf <<EOF
# ipsec.conf - strongSwan IPsec configuration file
# basic configuration
config setup
 # strictcrlpolicy=yes
 # uniqueids = no
# Add connections here.
# Sample VPN connections
conn %default
 ikelifetime=60m
 keylife=20m
 rekeymargin=3m
 keyingtries=1
 keyexchange=ikev1
 authby=secret
 ike=aes128-sha1-modp1024,3des-sha1-modp1024!
 esp=aes128-sha1-modp1024,3des-sha1-modp1024!
conn myvpn
 keyexchange=ikev1
 left=%defaultroute
 auto=add
 authby=secret
 type=transport
 leftprotoport=17/1701
 rightprotoport=17/1701
 right=$VPN_SERVER_IP
EOF
cat > /etc/ipsec.secrets <<EOF
: PSK "$VPN_IPSEC_PSK"
EOF
chmod 600 /etc/ipsec.secrets
# For CentOS/RHEL & Fedora ONLY
mv /etc/strongswan/ipsec.conf /etc/strongswan/ipsec.conf.old 2>/dev/null
mv /etc/strongswan/ipsec.secrets /etc/strongswan/ipsec.secrets.old 2>/dev/null
ln -s /etc/ipsec.conf /etc/strongswan/ipsec.conf
ln -s /etc/ipsec.secrets /etc/strongswan/ipsec.secrets
```

3. 配置xl2tpd

```bash
cat > /etc/xl2tpd/xl2tpd.conf <<EOF
[lac myvpn]
lns = $VPN_SERVER_IP
ppp debug = yes
pppoptfile = /etc/ppp/options.l2tpd.client
length bit = yes
EOF

cat > /etc/ppp/options.l2tpd.client <<EOF
ipcp-accept-local
ipcp-accept-remote
refuse-eap
require-chap
noccp
noauth
mtu 1280
mru 1280
noipdefault
defaultroute
usepeerdns
connect-delay 5000
name $VPN_USER
password $VPN_PASSWORD
EOF

chmod 600 /etc/ppp/options.l2tpd.client
```

4. 连接VPN

```bash
mkdir -p /var/run/xl2tpd
touch /var/run/xl2tpd/l2tp-control
service strongswan restart
service xl2tpd restart

## 连接VPN
strongswan up myvpn
echo "c myvpn" > /var/run/xl2tpd/l2tp-control

## 断开VPN
echo "d myvpn" > /var/run/xl2tpd/l2tp-control
strongswan down myvpn
```

## 扩展知识

比较一下现在主流VPN协议的优缺点

### PPTP

点对点隧道协议（英语：Point to Point Tunneling Protocol，缩写为PPTP）是实现虚拟专用网（VPN）的方式之一。PPTP使用传输控制协议（TCP）创建控制通道来发送控制命令，以及利用通用路由封装（GRE）通道来封装点对点协议（PPP）数据包以发送资料。这个协议最早由微软等厂商主导开发，但因为它的加密方式容易被破解，微软已经不再建议使用这个协议。

#### 优点

- 速度快
- 几乎所有平台都内置
- 配置极为简单

#### 缺点

- 受到美国国安局威胁
- 不安全

### L2TP and L2TP/IPsec

#### 优点

- 可供所有现代的设备及操作系统使用
- 容易设定

#### 缺点

- 比OpenVPN慢
- 可能受到美国国安局的威胁
- 与限制力强的防火请一起使用会有问题
- 美国国安局极有可能已经削弱这个协议的能力

### OpenVPN

OpenVPN是一个用于创建虚拟私人网络加密通道的软件包，最早由James Yonan编写。OpenVPN允许创建的VPN使用公开密钥、电子证书、或者用户名／密码来进行身份验证。

它大量使用了OpenSSL加密库中的SSL/TLS协议函数库。

OpenVPN的技术核心是虚拟网卡，其次是SSL协议实现。

#### 优点

- 具备能跨越大多数防火墙的能力
- 高度可配置
- 因为是开放资源，所以可以轻松修正后门
- 能使用各种加密功能运算法
- 高度安全性

#### 缺点

- 设定起来有点棘手
- 需要用到第三方软件
- 桌面电脑支援做得好，可是流动设备的则需要改进

### SSTP

SSTP可以创建一个在HTTPS上传送的VPN隧道，从而消除与基于PPTP（点对点隧道协议）或L2TP（第2层隧道协议）VPN连接有关的诸多问题。因为这些协议有可能受到某些位于客户端与服务器之间的Web代理、防火墙和网络地址转换（NAT）路由器的阻拦。

这种SSTP只适用于远程访问，不能支持站点与站点之间的VPN隧道。

#### 优点

- 具备越过大多数防火墙的能力
- 安全标准取决与密码，但一般来说是安全的
- 能完全融入Windows操作系统
- 微软支援

#### 缺点

- 因为是专利标准是由微软公司持有，因此不能修正后门
- 只能在Windows平台上操作

### IKEv2

因特网密钥交换（英语：Internet Key Exchange，简称IKE或IKEv2）是一种网络协议，归属于IPsec协议族，用以创建安全关系（Security association，SA）。它创建在奥克利协议（Oakley protocol）与ISAKMP协议的基础之上。

#### 优点

- 极度安全–支援各种密码如3DES、 AES、 AES 256等
- 支援黑莓设备
- 稳定，特别是在连接中断或者是交换网络使用时更是如此
- 容易设定，至少从用户终端是如此
- 比 L2TP、PPTP 及 SSTP相对更快速

#### 缺点

- 支援平台有限
- 为基础的方案像是SSTP或OpenVPN而较容易被阻挡，因为使用UDP 端口500
- 不是开放资源实现方案
- 在非服务器端施用IKEv2比较棘手，能导致一些潜在问题

## 参考

- [第二层隧道协议](https://zh.wikipedia.org/wiki/%E7%AC%AC%E4%BA%8C%E5%B1%82%E9%9A%A7%E9%81%93%E5%8D%8F%E8%AE%AE)
- [CentOS 7搭建L2TP VPN](https://www.wenjinyu.me/zh/centos-7-build-l2tp-vpn/#%E5%87%86%E5%A4%87)
- [CentOS7 搭建L2TP](https://www.linuxprobe.com/centos7-install-l2tp.html)
- [Centos7 搭建 L2TP+ IPsec VPN](https://imkira.com/CentOS7-L2TP-IPsec-VPN/)
- [L2TP连接尝试失败，因为安全层再初始化与远程计算机的协商时遇到一个处理错误](https://blog.csdn.net/weixin_44901564/article/details/106619826)
- [比较VPN协议: PPTP 对 L2TP 对 OpenVPN 对SSTP 对 IKEv2](https://zh.vpnmentor.com/blog/%e6%af%94%e8%be%83vpn%e5%8d%8f%e8%ae%ae-pptp-%e5%af%b9-l2tp-%e5%af%b9-openvpn-%e5%af%b9sstp-%e5%af%b9-ikev2/)
- [Configuring L2TP connection on Centos 7](https://www.myip.io/how-to-details/configure-l2tp-centos)
