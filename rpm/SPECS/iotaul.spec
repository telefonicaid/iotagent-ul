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
rm -Rf $RPM_BUILD_ROOT && mkdir -p $RPM_BUILD_ROOT
[ -d %{_build_root_project} ] || mkdir -p %{_build_root_project}

# Copy src files
cp -R %{_srcdir}/lib \
      %{_srcdir}/bin \
      %{_srcdir}/config.js \
      %{_srcdir}/package.json \
      %{_srcdir}/LICENSE \
      %{_build_root_project}

cp -R %{_topdir}/SOURCES/etc %{buildroot}

# -------------------------------------------------------------------------------------------- #
# Build section:
# -------------------------------------------------------------------------------------------- #
%build
echo "[INFO] Building RPM"
cd %{_build_root_project}

# Only production modules
rm -fR node_modules/
npm cache clear
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
      mv %{_install_dir}/config.js /tmp
fi

# -------------------------------------------------------------------------------------------- #
# post-install section:
# -------------------------------------------------------------------------------------------- #
%post
    echo "[INFO] Configuring application"
    echo "[INFO] Creating the home Ultralight IoT Agent directory"
    mkdir -p _install_dir
    echo "[INFO] Creating log & run directory"
    mkdir -p %{_iotaul_log_dir}
    chown -R %{_project_user}:%{_project_user} %{_iotaul_log_dir}
    chown -R %{_project_user}:%{_project_user} _install_dir
    chmod g+s %{_iotaul_log_dir}
    setfacl -d -m g::rwx %{_iotaul_log_dir}
    setfacl -d -m o::rx %{_iotaul_log_dir}

    mkdir -p %{_iotaul_pid_dir}
    chown -R %{_project_user}:%{_project_user} %{_iotaul_pid_dir}
    chown -R %{_project_user}:%{_project_user} _install_dir
    chmod g+s %{_iotaul_pid_dir}
    setfacl -d -m g::rwx %{_iotaul_pid_dir}
    setfacl -d -m o::rx %{_iotaul_pid_dir}

    echo "[INFO] Configuring application service"
    cd /etc/init.d
    chkconfig --add %{_service_name}

    # restores old configuration if any
    [ -f /tmp/config.js ] && mv /tmp/config.js %{_install_dir}/config.js
   
    # Create the default instance config file as a link
    ln -s %{_install_dir}/config.js %{_install_dir}/config-default.js

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
  [ -d %{_iotaul_log_dir} ] && rm -rfv %{_iotaul_log_dir}

  echo "[INFO] Removing application run files"
  # Log
  [ -d %{_iotaul_pid_dir} ] && rm -rfv %{_iotaul_pid_dir}

  echo "[INFO] Removing application files"
  # Installed files
  [ -d %{_install_dir} ] && rm -rfv %{_install_dir}

  echo "[INFO] Removing application user"
  userdel -fr %{_project_user}

  echo "[INFO] Removing application service"
  chkconfig --del %{_service_name}
  rm -Rf /etc/init.d/%{_service_name}
  echo "Done"
fi

# -------------------------------------------------------------------------------------------- #
# post-uninstall section:
# clean section:
# -------------------------------------------------------------------------------------------- #
%postun
%clean
rm -rf $RPM_BUILD_ROOT

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
