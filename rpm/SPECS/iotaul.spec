Summary: Ultralight 2.0 IoT Agent
Name: iotagent-ul
Version: %{_product_version}
Release: %{_product_release}
License: AGPLv3
BuildRoot: %{_topdir}/BUILDROOT/
BuildArch: x86_64
# Requires: nodejs >= 0.10.24
Requires: logrotate
Requires(post): /sbin/chkconfig, /usr/sbin/useradd npm
Requires(preun): /sbin/chkconfig, /sbin/service
Requires(postun): /sbin/service
Group: Applications/Engineering
Vendor: Telefonica I+D

%description
Ultralight 2.0 IoT Agent is a bridge between Ultralight 2.0 (a text-based lightweight protocol aimed at communications
for constrained devices) and the NGSI protocol, that can use different transport protocol bindings (such as MQTT and HTTP).
This component was designed to work alongside other Telefonica IoT Platform components.

# System folders
%define _srcdir $RPM_BUILD_ROOT/../../..
%define _service_name iotaul
%define _install_dir /opt/iotaul
%define _iotaul_log_dir /var/log/iotaul
%define _iotaul_pid_dir /var/run/iotaul
%define _iotaul_conf_dir /etc/iotaul.d


%define _iotaul_executable iotagent-ul

# RPM Building folder
%define _build_root_project %{buildroot}%{_install_dir}
# -------------------------------------------------------------------------------------------- #
# prep section, setup macro:
# -------------------------------------------------------------------------------------------- #
%prep
echo "[INFO] Preparing installation"
# Create rpm/BUILDROOT folder
/bin/rm -Rf $RPM_BUILD_ROOT && /bin/mkdir -p $RPM_BUILD_ROOT
[ -d %{_build_root_project} ] || /bin/mkdir -p %{_build_root_project}

# Copy src files
/bin/cp -R %{_srcdir}/lib \
      %{_srcdir}/bin \
      %{_srcdir}/config.js \
      %{_srcdir}/package.json \
      %{_srcdir}/LICENSE \
      %{_build_root_project}
      
[ -f %{_srcdir}/npm-shrinkwrap.json ] && /bin/cp %{_srcdir}/npm-shrinkwrap.json %{_build_root_project}

/bin/cp -R %{_topdir}/SOURCES/etc %{buildroot}

# -------------------------------------------------------------------------------------------- #
# Build section:
# -------------------------------------------------------------------------------------------- #
%build
echo "[INFO] Building RPM"
cd %{_build_root_project}

# Only production modules. We have found that --force is required to make this work for Node v8
/bin/rm -fR node_modules/
npm cache clear --force
npm install --production

# -------------------------------------------------------------------------------------------- #
# pre-install section:
# -------------------------------------------------------------------------------------------- #
%pre
echo "[INFO] Creating %{_project_user} user"
grep ^%{_project_user}: /etc/passwd
RET_VAL=$?
if [ "$RET_VAL" != "0" ]; then
      /usr/sbin/useradd -s "/bin/bash" -d %{_install_dir} %{_project_user}
      RET_VAL=$?
      if [ "$RET_VAL" != "0" ]; then
         echo "[ERROR] Unable create %{_project_user} user" \
         exit $RET_VAL
      fi
else
      /bin/mv %{_install_dir}/config.js /tmp
fi

# -------------------------------------------------------------------------------------------- #
# post-install section:
# -------------------------------------------------------------------------------------------- #
%post
    echo "[INFO] Configuring application"
    echo "[INFO] Creating the home Ultralight IoT Agent directory"
    /bin/mkdir -p _install_dir
    echo "[INFO] Creating log & run directory"
    /bin/mkdir -p %{_iotaul_log_dir}
    chown -R %{_project_user}:%{_project_user} %{_iotaul_log_dir}
    chown -R %{_project_user}:%{_project_user} _install_dir
    chmod g+s %{_iotaul_log_dir}
    setfacl -d -m g::rwx %{_iotaul_log_dir}
    setfacl -d -m o::rx %{_iotaul_log_dir}

    /bin/mkdir -p %{_iotaul_pid_dir}
    chown -R %{_project_user}:%{_project_user} %{_iotaul_pid_dir}
    chown -R %{_project_user}:%{_project_user} _install_dir
    chmod g+s %{_iotaul_pid_dir}
    setfacl -d -m g::rwx %{_iotaul_pid_dir}
    setfacl -d -m o::rx %{_iotaul_pid_dir}

    echo "[INFO] Configuring application service"
    cd /etc/init.d
    chkconfig --add %{_service_name}

    # restores old configuration if any
    [ -f /tmp/config.js ] && /bin/mv /tmp/config.js %{_install_dir}/config.js

    # Chmod iotagent-ul binary
    chmod guo+x %{_install_dir}/bin/%{_iotaul_executable}

    echo "Done"

# -------------------------------------------------------------------------------------------- #
# pre-uninstall section:
# -------------------------------------------------------------------------------------------- #
%preun

echo "[INFO] stoping service %{_service_name}"
service %{_service_name} stop &> /dev/null

if [ $1 == 0 ]; then

  echo "[INFO] Removing application log files"
  # Log
  [ -d %{_iotaul_log_dir} ] && /bin/rm -rf %{_iotaul_log_dir}

  echo "[INFO] Removing application run files"
  # Log
  [ -d %{_iotaul_pid_dir} ] && /bin/rm -rf %{_iotaul_pid_dir}

  echo "[INFO] Removing application files"
  # Installed files
  [ -d %{_install_dir} ] && /bin/rm -rf %{_install_dir}

  echo "[INFO] Removing application user"
  userdel -fr %{_project_user}

  echo "[INFO] Removing application service"
  chkconfig --del %{_service_name}
  /bin/rm -Rf /etc/init.d/%{_service_name}
  echo "Done"
fi

# -------------------------------------------------------------------------------------------- #
# post-uninstall section:
# clean section:
# -------------------------------------------------------------------------------------------- #
%postun
%clean
/bin/rm -rf $RPM_BUILD_ROOT

# -------------------------------------------------------------------------------------------- #
# Files to add to the RPM
# -------------------------------------------------------------------------------------------- #
%files
%defattr(644,%{_project_user},%{_project_user},755)
%config /etc/init.d/%{_service_name}
%attr(755, root, root) /etc/init.d/%{_service_name}
%config /etc/logrotate.d/logrotate-iotaul.conf
%config /etc/iotaul.d/iotaul.default.conf
%config /etc/cron.d/cron-logrotate-iotaul-size
%config /etc/sysconfig/logrotate-iotaul-size
%config /etc/sysconfig/iotaul.conf
%{_install_dir}

%changelog
* Wed May 22 2019 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.9.0
- Set Nodejs 6 version in packages.json (effectively removing Nodev4 as supported version)
- Add: config.http.timeout (and associated enviroment variable IOTA_HTTP_TIMEOUT)(#97)
- Upgrade NodeJS version from 8.12.0 to 8.16.0 in Dockerfile to improve security
- Upgrade logops dependency from 1.0.8 to 2.1.0
- Upgrade iotagent-node-lib dependency from 2.8.1 to 2.9.0

* Wed Dec 19 2018 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.8.0
- Add: use timestamp configuration from group device
- Add: use AMQP message handler, add reconnections and error handlers
- Add: AMQP config env vars (#268)
- Add: npm scripts to execute tests, coverage, watch and clean
- Add: use NodeJS 8 in dockerfile
- Add: use PM2 in Dockerfile
- Fix: AMQP callback over-calling
- Fix: check QoS option for MQTT commands
- Fix: remove config-blank.js file
- Upgrade: iotagent-node-lib dependence from 2.7.x to 2.8.1
- Upgrade: mqtt dependence from 1.14.1 to 2.18.8
- Upgrade: logops dependence from 1.0.0-alpha.7 to 1.0.8
- Upgrade: async dependence from 1.5.2 to 2.6.1
- Upgrade: body-parser dependence from 1.15.0 to 1.18.3
- Upgrade: express dependence from ~4.11.2 to ~4.16.4
- Upgrade: request dependence from 2.81.0 to 2.88.0
- Upgrade: underscore dependence from 1.8.3 to 1.9.1
- Upgrade: dateformat dependence from 1.0.12 to 3.0.3
- Upgrade: nock development dependence from 9.0.14 to 10.0.1
- Upgrade: mocha development dependence from 2.4.5 to 5.2.0
- Upgrade: should development dependence from 8.4.0 to 13.2.3
- Upgrade: istanbul development dependence from ~0.1.34 to ~0.4.5
- Upgrade: moment development dependence from ~2.20.1 to ~2.22.2
- Upgrade: timekeeper development dependence from 0.0.5 to 2.1.2
- Remove: old unused development dependencies (closure-linter-wrapper, sinon-chai, sinon, chai, grunt and grunt related modules)

* Mon Aug 06 2018 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.7.0
- Update iotagent-node-lib to 2.7.x
- Add: allow NGSIv2 for updating active attributes at CB, throught configuration based on iotagent-node-lib(#233)
- Add: supports NGSIv2 for device provisioning (entity creation and context registration) at CB (#233)
- Add: unhardwire MQTT qos and retain parameters in config.js (involving new env vars IOTA_MQTT_QOS and IOTA_MQTT_RETAIN) (#255)
- Fix: parameter order for the MEASURE-001 error message (#264)
- Fix: upgrade mqtt dep from 1.7.0 to 1.14.1
- Using precise dependencies (~=) in packages.json
- Remove mongodb dependence from packages.json (already in iota-node-lib)

* Mon Feb 26 2018 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.6.0
- Update ioagent-node-lib to 2.6.x
- Fix transport in autoprovision device depending on binding (#235)
- Allow get list of commands without sending measures (empty payload) (#234)

* Wed Oct 18 2017 Fermin Galan <fermin.galanmarquez@telefonica.com> 1.5.0
- FEATURE update node version to 4.8.4
- Update MongoDB driver in order to fix NODE-818 error (#210)

* Tue Nov 09 2016 Daniel Moran <daniel.moranjimenez@telefonica.com> 1.4.0
- Polling mode for HTTP commands (#24)
- Duplicated TimeInstant when an active attribute is mapped to TimeInstant attributes (#150)
- Add multientity, bidirectionality and expression plugins (#161)
- Poll commands not removed after device request (#160)
- Logrotate configure correctly all possible log files (#164)
- FIX Command error response message not sent to context Broker (#176)
- FIX Transformed data should include Metadata field (#179)
- ADD alarms for the Mosquitto server #187Add alarms for the Mosquitto server #187

* Tue Oct 04 2016 Daniel Moran <daniel.moranjimenez@telefonica.com> 1.3.0
- Polling mode for HTTP commands (#24)
- Duplicated TimeInstant when an active attribute is mapped to TimeInstant attributes (#150)

* Fri Sep 09 2016 Daniel Moran <daniel.moranjimenez@telefonica.com> 1.2.0
- FIX Accept initial bar for Ultraligth measures (#98).
- FIX Allow unprovisioned devices for HTTP UL (#100).
- FIX Allow for request without a Content-type header (#102);
- ADD Optional timestamp for measure groups (#105).
- Allow unprovisioned devices for MQTT UL #108
- FIX Protocol attribute not added to the autoprovisioned devices
- Use the attributes defined in the Configuration as default alias values (#114)
- Add HTTP UL testing commands to the command line interpreter (#126)
- FIX Commands won't write the Error results in the Context Broker.
- FIX HTTP Error connecting to CB not decoded
- Create the Operations Manual #33
- Improve global documentation.
- FIX Logger modules not being singleton cause logging inconsistencies (#140)
